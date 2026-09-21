-- Trust decisions are explicit and audited. Resolution only resumes the recorded state.
alter table public.reports add column resolution_reason text;

create function private.trust_reason(p_reason text) returns text
language plpgsql immutable set search_path='' as $$
declare v_reason text:=btrim(coalesce(p_reason,''));
begin
  if char_length(v_reason) not between 8 and 2000 or translate(v_reason,E'\t\r\n','') ~ '[[:cntrl:]]' then
    raise exception 'A reason of 8–2000 characters without unsupported control characters is required';
  end if;
  return v_reason;
end $$;

create function private.report_json(p public.reports) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',p.id,'listingId',p.listing_id,'reason',p.reason,'status',p.status,'createdAt',p.created_at,'resolutionReason',p.resolution_reason)
$$;
create function private.dispute_json(p public.disputes) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',p.id,'orderId',p.order_id,'reason',p.reason,'status',p.status,'previousStatus',p.previous_status,'resolutionReason',p.resolution_reason,'createdAt',p.created_at,'updatedAt',p.updated_at)
$$;

create function public.report_listing(p_listing_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_reason text:=private.trust_reason(p_reason); r public.reports%rowtype;
begin
  -- Listing lock serializes duplicate submissions without destroying historical reports.
  perform 1 from public.listings l join public.auctions a on a.listing_id=l.id
    where l.id=p_listing_id and l.deleted_at is null and a.state not in ('DRAFT','PENDING_REVIEW','REJECTED') for update of l;
  if not found then raise exception 'Listing not found'; end if;
  select * into r from public.reports where listing_id=p_listing_id and reporter_id=v_actor and status='open' order by created_at limit 1;
  if found then return private.report_json(r); end if;
  insert into public.reports(reporter_id,listing_id,reason) values(v_actor,p_listing_id,v_reason) returning * into r;
  return private.report_json(r);
end $$;

create function public.review_report(p_report_id uuid,p_decision text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.require_admin(); v_reason text:=private.trust_reason(p_reason); r public.reports%rowtype;
begin
  if p_decision is null or p_decision not in ('reviewed','dismissed') then raise exception 'Decision must be reviewed or dismissed'; end if;
  select * into r from public.reports where id=p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if r.status=p_decision then return private.report_json(r); end if;
  if r.status<>'open' then raise exception 'This report has already been reviewed'; end if;
  update public.reports set status=p_decision,resolution_reason=v_reason,updated_at=clock_timestamp() where id=r.id returning * into r;
  perform private.audit(v_admin,'report_'||p_decision,r.id,v_reason);
  return private.report_json(r);
end $$;

create function public.order_dispute(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); o public.orders%rowtype; d public.disputes%rowtype;
begin
  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_actor not in (o.buyer_id,o.seller_id) and not private.is_admin() then raise exception 'Order participant required' using errcode='42501'; end if;
  select * into d from public.disputes where order_id=o.id;
  if not found then return null; end if;
  return private.dispute_json(d);
end $$;

create function public.open_dispute(p_order_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_reason text:=private.trust_reason(p_reason); o public.orders%rowtype; d public.disputes%rowtype; v_state text;
begin
  select * into o from public.orders where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
  select state into v_state from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=p_order_id for update;
  if v_actor not in (o.buyer_id,o.seller_id) then raise exception 'Order participant required' using errcode='42501'; end if;
  select * into d from public.disputes where order_id=o.id;
  if found then return private.dispute_json(d); end if;
  if o.status not in ('PAID','FULFILLMENT') or v_state is distinct from o.status then raise exception 'Only paid or shipped orders can be disputed'; end if;
  insert into public.disputes(order_id,initiator_id,reason,previous_status) values(o.id,v_actor,v_reason,o.status) returning * into d;
  update public.orders set status='DISPUTED',updated_at=clock_timestamp() where id=o.id;
  update public.auctions set state='DISPUTED',version=version+1,updated_at=clock_timestamp() where id=o.auction_id;
  perform private.notify(o.buyer_id,'dispute_opened','dispute-buyer:'||d.id,'Order paused for review','A dispute is open. Order actions are paused.','/orders/'||o.id);
  perform private.notify(o.seller_id,'dispute_opened','dispute-seller:'||d.id,'Order paused for review','A dispute is open. Order actions are paused.','/orders/'||o.id);
  return private.dispute_json(d);
end $$;

create function public.resolve_dispute(p_dispute_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.require_admin(); v_reason text:=private.trust_reason(p_reason); o public.orders%rowtype; d public.disputes%rowtype; v_state text;
begin
  select * into d from public.disputes where id=p_dispute_id;
  if not found then raise exception 'Dispute not found'; end if;
  select * into o from public.orders where id=d.order_id;
  select state into v_state from public.auctions where id=o.auction_id for update;
  select * into o from public.orders where id=d.order_id for update;
  select * into d from public.disputes where id=p_dispute_id for update;
  if d.status='resolved_resume' then return private.dispute_json(d); end if;
  if d.status<>'open' or o.status<>'DISPUTED' or v_state<>'DISPUTED' or d.previous_status not in ('PAID','FULFILLMENT') then raise exception 'This dispute cannot resume its order'; end if;
  update public.orders set status=d.previous_status,updated_at=clock_timestamp() where id=o.id;
  update public.auctions set state=d.previous_status,version=version+1,updated_at=clock_timestamp() where id=o.auction_id;
  update public.disputes set status='resolved_resume',resolution_reason=v_reason,updated_at=clock_timestamp() where id=d.id returning * into d;
  perform private.audit(v_admin,'dispute_resumed',d.id,v_reason);
  perform private.notify(o.buyer_id,'dispute_resolved','resolved-buyer:'||d.id,'Order resumed','The dispute was reviewed. Your order has resumed.','/orders/'||o.id);
  perform private.notify(o.seller_id,'dispute_resolved','resolved-seller:'||d.id,'Order resumed','The dispute was reviewed. Your order has resumed.','/orders/'||o.id);
  return private.dispute_json(d);
end $$;

create function public.set_account_suspension(p_user_id uuid,p_suspended boolean,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=private.require_admin(); v_reason text:=private.trust_reason(p_reason); r private.account_roles%rowtype; v_name text;
begin
  if p_suspended is null then raise exception 'A suspension decision is required'; end if;
  select * into r from private.account_roles where user_id=p_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if r.user_id=v_admin or r.role='admin' then raise exception 'Administrator accounts cannot be suspended here' using errcode='42501'; end if;
  if r.suspended is distinct from p_suspended then
    update private.account_roles set suspended=p_suspended where user_id=r.user_id;
    perform private.audit(v_admin,case when p_suspended then 'account_suspended' else 'account_restored' end,r.user_id,v_reason);
  end if;
  select display_name into v_name from public.profiles where id=r.user_id;
  return jsonb_build_object('userId',r.user_id,'displayName',v_name,'role',r.role,'suspended',p_suspended);
end $$;

create function public.trust_safety_dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'reports',coalesce((select jsonb_agg(private.report_json(r)||jsonb_build_object('listingTitle',l.title,'listingSlug',l.slug,'sellerId',sa.user_id,'reporterId',r.reporter_id) order by r.created_at desc) from public.reports r join public.listings l on l.id=r.listing_id join private.seller_accounts sa on sa.seller_id=l.seller_id),'[]'::jsonb),
    'disputes',coalesce((select jsonb_agg(private.dispute_json(d)||jsonb_build_object('listingTitle',l.title,'buyerId',o.buyer_id,'sellerId',o.seller_id) order by d.created_at desc) from public.disputes d join public.orders o on o.id=d.order_id join public.auctions a on a.id=o.auction_id join public.listings l on l.id=a.listing_id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('userId',r.user_id,'displayName',p.display_name,'role',r.role,'suspended',r.suspended) order by p.display_name,r.user_id) from private.account_roles r join public.profiles p on p.id=r.user_id),'[]'::jsonb)
  );
end $$;

revoke all on function private.trust_reason(text),private.report_json(public.reports),private.dispute_json(public.disputes) from public,anon,authenticated;
revoke all on function public.report_listing(uuid,text),public.review_report(uuid,text,text),public.order_dispute(uuid),public.open_dispute(uuid,text),public.resolve_dispute(uuid,text),public.set_account_suspension(uuid,boolean,text),public.trust_safety_dashboard() from public,anon,authenticated;
grant execute on function public.report_listing(uuid,text),public.review_report(uuid,text,text),public.order_dispute(uuid),public.open_dispute(uuid,text),public.resolve_dispute(uuid,text),public.set_account_suspension(uuid,boolean,text),public.trust_safety_dashboard() to authenticated;
