-- M5: mock pay → ship → receive → review. SQL is the order of record.
-- Lock order matches settlement: auction row, then order row.

create function public.order_snapshot(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  o public.orders%rowtype;
  p public.payments%rowtype;
  s public.shipments%rowtype;
  rv public.reviews%rowtype;
begin
  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;
  select * into p from public.payments where order_id=o.id;
  select * into s from public.shipments where order_id=o.id;
  select * into rv from public.reviews where order_id=o.id order by created_at limit 1;
  return jsonb_build_object(
    'id',o.id,
    'status',o.status,
    'winning_bid',o.winning_bid,
    'buyer_fee',o.buyer_fee,
    'shipping_amount',o.shipping_amount,
    'total',o.total,
    'payment_deadline',o.payment_deadline,
    'completed_at',o.completed_at,
    'payment',case when p.id is null then null else jsonb_build_object(
      'id',p.id,'provider',p.provider,'status',p.status,'amount',p.amount
    ) end,
    'shipment',case when s.id is null then null else jsonb_build_object(
      'carrier',s.carrier,'tracking_number',s.tracking_number,'shipped_at',s.shipped_at,'received_at',s.received_at
    ) end,
    'review',case when rv.id is null then null else jsonb_build_object(
      'rating',rv.rating,'body',rv.body
    ) end
  );
end $$;
revoke all on function public.order_snapshot(uuid) from public,anon,authenticated;

create function public.pay_order(p_order_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  o public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if p_order_id is null then raise exception 'Order not found' using errcode='P0001'; end if;
  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 128
     or p_idempotency_key !~ '^[A-Za-z0-9_.:-]+$' then
    raise exception 'An 8–128 character idempotency key is required' using errcode='P0001';
  end if;

  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;
  perform 1 from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;

  if o.buyer_id is distinct from v_actor then
    raise exception 'Only the winning buyer can pay this order' using errcode='42501';
  end if;

  select * into v_payment from public.payments where order_id=o.id;
  if found then
    if v_payment.idempotency_key is not distinct from p_idempotency_key then
      return public.order_snapshot(o.id);
    end if;
    raise exception 'Payment is already recorded for this order' using errcode='P0001';
  end if;

  if o.status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'This order is not awaiting payment' using errcode='P0001';
  end if;
  if o.payment_deadline<=v_now then
    raise exception 'The payment deadline has passed' using errcode='P0001';
  end if;

  insert into public.payments(order_id,provider,provider_reference,idempotency_key,amount,status,created_at,updated_at)
    values(o.id,'mock','mock_pay_'||replace(o.id::text,'-',''),p_idempotency_key,o.total,'paid',v_now,v_now);
  insert into private.payment_events(provider,event_id,order_id,created_at)
    values('mock','paid:'||o.id::text,o.id,v_now)
    on conflict do nothing;

  update public.orders set status='PAID',updated_at=v_now where id=o.id;
  update public.auctions set state='PAID',version=version+1,updated_at=v_now where id=o.auction_id;

  perform private.notify(o.seller_id,'payment_received','paid:'||o.id,'The buyer has paid','A mock payment is recorded. Ship the lot.','/orders/'||o.id);
  perform private.notify(v_actor,'payment_confirmed','paid-buyer:'||o.id,'Payment recorded','AUCTA recorded a mock payment. No money was collected.','/orders/'||o.id);

  return public.order_snapshot(o.id);
end $$;
revoke all on function public.pay_order(uuid,text) from public,anon,authenticated;
grant execute on function public.pay_order(uuid,text) to authenticated;

create function public.ship_order(p_order_id uuid, p_carrier text, p_tracking text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  o public.orders%rowtype;
  s public.shipments%rowtype;
  v_carrier text:=btrim(coalesce(p_carrier,''));
  v_tracking text:=btrim(coalesce(p_tracking,''));
  v_now timestamptz:=clock_timestamp();
begin
  if p_order_id is null then raise exception 'Order not found' using errcode='P0001'; end if;
  if char_length(v_carrier)<2 or char_length(v_carrier)>80 or v_carrier ~ '[\u0000-\u001f\u007f]' then
    raise exception 'A carrier name of 2–80 characters is required' using errcode='P0001';
  end if;
  if v_tracking !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,99}$' then
    raise exception 'A tracking number of 4–100 letters, digits or common separators is required' using errcode='P0001';
  end if;

  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;
  perform 1 from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=p_order_id for update;

  if o.seller_id is distinct from v_actor then
    raise exception 'Only the seller can mark this order as shipped' using errcode='42501';
  end if;

  select * into s from public.shipments where order_id=o.id;
  if found then
    if s.carrier is not distinct from v_carrier and s.tracking_number is not distinct from v_tracking then
      return public.order_snapshot(o.id);
    end if;
    raise exception 'This order already has a shipment' using errcode='P0001';
  end if;

  if o.status is distinct from 'PAID' then
    raise exception 'This order is not ready to ship' using errcode='P0001';
  end if;

  insert into public.shipments(order_id,carrier,tracking_number,shipped_at,created_at,updated_at)
    values(o.id,v_carrier,v_tracking,v_now,v_now,v_now);
  update public.orders set status='FULFILLMENT',updated_at=v_now where id=o.id;
  update public.auctions set state='FULFILLMENT',version=version+1,updated_at=v_now where id=o.auction_id;
  perform private.notify(o.buyer_id,'item_shipped','shipped:'||o.id,'Item shipped',v_carrier||' '||v_tracking,'/orders/'||o.id);

  return public.order_snapshot(o.id);
end $$;
revoke all on function public.ship_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ship_order(uuid,text,text) to authenticated;

create function public.confirm_received(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  o public.orders%rowtype;
  s public.shipments%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if p_order_id is null then raise exception 'Order not found' using errcode='P0001'; end if;

  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;
  perform 1 from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=p_order_id for update;

  if o.buyer_id is distinct from v_actor then
    raise exception 'Only the buyer can confirm receipt' using errcode='42501';
  end if;

  select * into s from public.shipments where order_id=o.id for update;
  if not found then raise exception 'This order has not shipped yet' using errcode='P0001'; end if;
  if s.received_at is not null then
    return public.order_snapshot(o.id);
  end if;
  if o.status is distinct from 'FULFILLMENT' then
    raise exception 'This order is not in transit' using errcode='P0001';
  end if;

  update public.shipments set received_at=v_now,updated_at=v_now where id=s.id;
  update public.orders set updated_at=v_now where id=o.id;
  perform private.notify(o.seller_id,'item_received','received:'||o.id,'Item received','The buyer confirmed the lot arrived.','/orders/'||o.id);

  return public.order_snapshot(o.id);
end $$;
revoke all on function public.confirm_received(uuid) from public,anon,authenticated;
grant execute on function public.confirm_received(uuid) to authenticated;

create function public.review_order(p_order_id uuid, p_rating integer, p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  o public.orders%rowtype;
  s public.shipments%rowtype;
  rv public.reviews%rowtype;
  v_alias text;
  v_shop uuid;
  v_body text:=btrim(coalesce(p_body,''));
  v_now timestamptz:=clock_timestamp();
  v_review uuid:=gen_random_uuid();
begin
  if p_order_id is null then raise exception 'Order not found' using errcode='P0001'; end if;
  if p_rating is null or p_rating<1 or p_rating>5 then
    raise exception 'Choose a rating from 1 to 5' using errcode='P0001';
  end if;
  if char_length(v_body)<2 or char_length(v_body)>2000 then
    raise exception 'Write a review between 2 and 2000 characters' using errcode='P0001';
  end if;

  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found' using errcode='P0001'; end if;
  perform 1 from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=p_order_id for update;

  if o.buyer_id is distinct from v_actor then
    raise exception 'Only the buyer can review this order' using errcode='42501';
  end if;

  select r.* into rv from public.reviews r
    join private.review_authors a on a.review_id=r.id
    where a.order_id=o.id and a.author_id=v_actor;
  if found then
    return public.order_snapshot(o.id);
  end if;

  select * into s from public.shipments where order_id=o.id;
  if s.received_at is null then
    raise exception 'Confirm receipt before reviewing' using errcode='P0001';
  end if;
  if o.status is distinct from 'FULFILLMENT' then
    raise exception 'This order cannot be reviewed yet' using errcode='P0001';
  end if;

  select display_name into v_alias from public.profiles where id=v_actor;
  select sa.seller_id into v_shop from private.seller_accounts sa where sa.user_id=o.seller_id;

  insert into public.reviews(id,order_id,author_alias,recipient_seller_id,rating,body,created_at)
    values(v_review,o.id,coalesce(v_alias,'Buyer'),v_shop,p_rating,v_body,v_now);
  insert into private.review_authors(review_id,order_id,author_id,recipient_id)
    values(v_review,o.id,v_actor,o.seller_id);

  update public.orders set status='COMPLETED',completed_at=v_now,updated_at=v_now where id=o.id;
  update public.auctions set state='COMPLETED',version=version+1,updated_at=v_now where id=o.auction_id;
  insert into public.payouts(order_id,provider,provider_reference,idempotency_key,amount,status,created_at,updated_at)
    values(o.id,'mock','mock_po_'||replace(o.id::text,'-',''),'payout:'||o.id::text,o.seller_net,'pending',v_now,v_now)
    on conflict(order_id) do nothing;

  perform private.notify(o.seller_id,'review_published','reviewed:'||o.id,'Sale complete','The buyer published a review. Payout remains pending in local mock mode.','/orders/'||o.id);

  return public.order_snapshot(o.id);
end $$;
revoke all on function public.review_order(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.review_order(uuid,integer,text) to authenticated;
