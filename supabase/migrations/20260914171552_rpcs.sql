-- Public allowlisted RPCs. Named p_* arguments. No reserve/proxy/email/address on catalogue rows.
create function private.auction_public_json(p_auction_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  a public.auctions%rowtype;
  l public.listings%rowtype;
  c public.categories%rowtype;
  s public.seller_profiles%rowtype;
  v_sold_at timestamptz;
  v_rating numeric;
  v_sales integer;
begin
  select * into a from public.auctions where id=p_auction_id;
  if not found then return null; end if;
  select * into l from public.listings where id=a.listing_id;
  select * into c from public.categories where id=l.category_id;
  select * into s from public.seller_profiles where id=l.seller_id;
  select coalesce(o.completed_at,o.created_at) into v_sold_at from public.orders o where o.auction_id=a.id;
  select count(*)::integer into v_sales
    from public.orders o
    join private.seller_accounts sa on sa.user_id=o.seller_id
    where sa.seller_id=s.id and o.status='COMPLETED';
  select avg(rv.rating) into v_rating from public.reviews rv where rv.recipient_seller_id=s.id;
  return jsonb_build_object(
    'id',a.id,
    'listing_id',a.listing_id,
    'state',a.state,
    'starting_price',a.starting_price,
    'current_price',a.current_price,
    'shipping_price',a.shipping_price,
    'increment_override',a.increment_override,
    'bid_count',a.bid_count,
    'bidder_count',a.bidder_count,
    'watch_count',a.watch_count,
    'has_reserve',a.has_reserve,
    'reserve_met',a.reserve_met,
    'featured',a.featured,
    'sample',a.sample,
    'starts_at',a.starts_at,
    'ends_at',a.ends_at,
    'sold_at',v_sold_at,
    'listing',jsonb_build_object(
      'id',l.id,
      'slug',l.slug,
      'title',l.title,
      'subtitle',l.brand,
      'description',l.description,
      'condition',l.condition,
      'flaws',l.flaws,
      'provenance',l.provenance,
      'brand',l.brand,
      'attributes',l.attributes,
      'image_urls',l.image_urls,
      'image_alt',l.title,
      'sample',l.sample,
      'category_slug',c.slug,
      'category_name',c.name,
      'category',jsonb_build_object('slug',c.slug,'name',c.name)
    ),
    'seller',jsonb_build_object(
      'id',s.id,
      'shop_name',s.shop_name,
      'name',s.shop_name,
      'city',s.city,
      'province',s.province,
      'verification_status',s.verification_status,
      'verified',s.verification_status='verified',
      'created_at',s.created_at,
      'rating',v_rating,
      'completed_sales',coalesce(v_sales,0)
    )
  );
end $$;

create function public.catalogue() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_auctions jsonb;
begin
  select coalesce(jsonb_agg(private.auction_public_json(a.id) order by a.featured desc,a.ends_at),'[]'::jsonb)
    into v_auctions
    from public.auctions a
    join public.listings l on l.id=a.listing_id
    where l.deleted_at is null and a.state not in ('DRAFT','PENDING_REVIEW','REJECTED');
  return jsonb_build_object('auctions',v_auctions,'server_time',clock_timestamp());
end $$;

create function public.auction_detail(p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  a public.auctions%rowtype;
  v_uid uuid:=auth.uid();
  v_bids jsonb;
  v_watching boolean:=false;
  v_leading boolean:=false;
  v_max bigint;
  v_empty jsonb:=jsonb_build_object('auction',null,'bids','[]'::jsonb,'is_watching',false,'is_leading',false,'own_maximum',null,'server_time',clock_timestamp());
begin
  if p_slug is null or char_length(trim(p_slug))=0 then return v_empty; end if;
  select lot.* into a
    from public.auctions lot
    join public.listings l on l.id=lot.listing_id
    where l.deleted_at is null and (l.slug=p_slug or lot.id::text=lower(p_slug))
    limit 1;
  if not found then return v_empty; end if;
  if a.state in ('DRAFT','PENDING_REVIEW','REJECTED')
     and not private.is_admin()
     and not exists(
       select 1 from public.listings l
       join private.seller_accounts s on s.seller_id=l.seller_id
       where l.id=a.listing_id and s.user_id=v_uid
     ) then
    return v_empty;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',b.id,
      'bidder_alias',b.bidder_alias,
      'alias',b.bidder_alias,
      'amount',b.amount,
      'visible_price',b.amount,
      'automatic',b.automatic,
      'created_at',b.created_at
    ) order by b.created_at desc),'[]'::jsonb)
    into v_bids
    from public.bids b where b.auction_id=a.id;
  if v_uid is not null then
    v_watching:=exists(select 1 from public.watchlists w where w.user_id=v_uid and w.auction_id=a.id);
    v_leading:=exists(select 1 from private.auction_rules r where r.auction_id=a.id and r.winning_user_id=v_uid);
    select pb.maximum into v_max from private.proxy_bids pb where pb.auction_id=a.id and pb.bidder_id=v_uid;
  end if;
  return jsonb_build_object(
    'auction',private.auction_public_json(a.id),
    'bids',v_bids,
    'is_watching',v_watching,
    'is_leading',v_leading,
    'own_maximum',v_max,
    'server_time',clock_timestamp()
  );
end $$;

create function public.dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  v_profile public.profiles%rowtype;
  v_role private.account_roles%rowtype;
  v_seller public.seller_profiles%rowtype;
  v_has_seller boolean:=false;
  v_admin boolean;
  v_seller_json jsonb;
  v_auctions jsonb;
  v_bidding jsonb;
  v_watchlist jsonb;
  v_orders jsonb;
  v_shipments jsonb;
  v_reviews jsonb;
  v_notifications jsonb;
  v_pending_listings jsonb:='[]'::jsonb;
  v_pending_sellers jsonb:='[]'::jsonb;
  v_reports jsonb:='[]'::jsonb;
  v_disputes jsonb:='[]'::jsonb;
  v_audit jsonb:='[]'::jsonb;
begin
  select * into v_profile from public.profiles where id=v_actor;
  select * into v_role from private.account_roles where user_id=v_actor;
  v_admin:=(v_role.role='admin');
  select sp.* into v_seller
    from public.seller_profiles sp
    join private.seller_accounts sa on sa.seller_id=sp.id
    where sa.user_id=v_actor;
  v_has_seller:=found;
  if v_has_seller then
    v_seller_json:=to_jsonb(v_seller)||jsonb_build_object('name',v_seller.shop_name,'verified',v_seller.verification_status='verified');
  else
    v_seller_json:=null;
  end if;
  select coalesce(jsonb_agg(private.auction_public_json(a.id) order by a.created_at desc),'[]'::jsonb)
    into v_auctions
    from public.auctions a
    join public.listings l on l.id=a.listing_id
    join private.seller_accounts sa on sa.seller_id=l.seller_id
    where sa.user_id=v_actor;
  select coalesce(jsonb_agg(private.auction_public_json(a.id) order by a.ends_at),'[]'::jsonb)
    into v_bidding
    from public.auctions a
    join private.proxy_bids pb on pb.auction_id=a.id
    where pb.bidder_id=v_actor;
  select coalesce(jsonb_agg(w.auction_id order by w.created_at desc),'[]'::jsonb)
    into v_watchlist
    from public.watchlists w where w.user_id=v_actor;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,
      'auction_id',o.auction_id,
      'buyer_id',o.buyer_id,
      'seller_id',o.seller_id,
      'status',o.status,
      'state',o.status,
      'winning_bid',o.winning_bid,
      'buyer_fee',o.buyer_fee,
      'seller_fee',o.seller_fee,
      'shipping_amount',o.shipping_amount,
      'shipping_price',o.shipping_amount,
      'total',o.total,
      'total_amount',o.total,
      'payment_deadline',o.payment_deadline,
      'created_at',o.created_at,
      'completed_at',o.completed_at,
      'address',o.address,
      'auction',private.auction_public_json(o.auction_id)
    ) order by o.created_at desc),'[]'::jsonb)
    into v_orders
    from public.orders o
    where o.buyer_id=v_actor or o.seller_id=v_actor or v_admin;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,
      'order_id',s.order_id,
      'carrier',s.carrier,
      'tracking_number',s.tracking_number,
      'shipped_at',s.shipped_at,
      'received_at',s.received_at
    ) order by s.created_at desc),'[]'::jsonb)
    into v_shipments
    from public.shipments s
    join public.orders o on o.id=s.order_id
    where o.buyer_id=v_actor or o.seller_id=v_actor or v_admin;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',rv.id,
      'order_id',rv.order_id,
      'rating',rv.rating,
      'body',rv.body,
      'text',rv.body,
      'author_alias',rv.author_alias
    ) order by rv.created_at desc),'[]'::jsonb)
    into v_reviews
    from public.reviews rv
    join public.orders o on o.id=rv.order_id
    where o.buyer_id=v_actor or o.seller_id=v_actor or v_admin;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',n.id,
      'type',n.type,
      'title',n.title,
      'message',n.message,
      'href',n.href,
      'payload',n.payload,
      'read_at',n.read_at,
      'created_at',n.created_at
    ) order by n.created_at desc),'[]'::jsonb)
    into v_notifications
    from public.notifications n where n.user_id=v_actor;
  if v_admin then
    select coalesce(jsonb_agg(private.auction_public_json(a.id) order by a.created_at),'[]'::jsonb)
      into v_pending_listings
      from public.auctions a where a.state='PENDING_REVIEW';
    select coalesce(jsonb_agg(to_jsonb(sp)||jsonb_build_object('name',sp.shop_name,'verified',false) order by sp.created_at),'[]'::jsonb)
      into v_pending_sellers
      from public.seller_profiles sp where sp.verification_status='pending';
    select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'reason',rp.reason,'status',rp.status,'state',rp.status,'listing_id',rp.listing_id) order by rp.created_at desc),'[]'::jsonb)
      into v_reports from public.reports rp;
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'reason',d.reason,'status',d.status,'state',d.status,'order_id',d.order_id) order by d.created_at desc),'[]'::jsonb)
      into v_disputes from public.disputes d;
    select coalesce(jsonb_agg(jsonb_build_object('id',al.id,'action',al.action,'created_at',al.created_at) order by al.created_at desc),'[]'::jsonb)
      into v_audit from private.audit_logs al;
  end if;
  return jsonb_build_object(
    'profile',jsonb_build_object('id',v_profile.id,'display_name',v_profile.display_name,'role',v_role.role,'suspended',v_role.suspended),
    'seller',v_seller_json,
    'auctions',v_auctions,
    'bidding',v_bidding,
    'watchlist',v_watchlist,
    'orders',v_orders,
    'shipments',v_shipments,
    'reviews',v_reviews,
    'notifications',v_notifications,
    'pending_listings',v_pending_listings,
    'pending_sellers',v_pending_sellers,
    'reports',v_reports,
    'disputes',v_disputes,
    'audit',v_audit
  );
end $$;

create function public.toggle_watch(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  a public.auctions%rowtype;
  v_watching boolean;
  v_count integer;
begin
  select * into a from public.auctions where id=p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if exists(select 1 from public.watchlists w where w.user_id=v_actor and w.auction_id=a.id) then
    delete from public.watchlists where user_id=v_actor and auction_id=a.id;
    v_watching:=false;
  else
    insert into public.watchlists(user_id,auction_id) values(v_actor,a.id);
    v_watching:=true;
  end if;
  update public.auctions
    set watch_count=(select count(*) from public.watchlists w where w.auction_id=a.id),
        updated_at=clock_timestamp()
    where id=a.id
    returning watch_count into v_count;
  return jsonb_build_object('watching',v_watching,'watch_count',v_count);
end $$;

create function public.place_bid(p_auction_id uuid,p_maximum bigint,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return private.auction_bid(p_auction_id,p_maximum,p_idempotency_key);
end $$;

create function public.settle_due(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return private.auction_settle_due(p_limit);
end $$;

revoke all on function private.auction_public_json(uuid) from public,anon,authenticated;
revoke all on function private.auction_bid(uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function private.auction_settle(uuid) from public,anon,authenticated;
revoke all on function private.auction_settle_due(integer) from public,anon,authenticated;
revoke all on function public.catalogue() from public;
revoke all on function public.auction_detail(text) from public;
revoke all on function public.dashboard() from public;
revoke all on function public.toggle_watch(uuid) from public;
revoke all on function public.place_bid(uuid,bigint,uuid) from public;
revoke all on function public.settle_due(integer) from public;
grant execute on function public.catalogue() to anon,authenticated;
grant execute on function public.auction_detail(text) to anon,authenticated;
grant execute on function public.dashboard() to authenticated;
grant execute on function public.toggle_watch(uuid) to authenticated;
grant execute on function public.place_bid(uuid,bigint,uuid) to authenticated;
grant execute on function public.settle_due(integer) to anon,authenticated,service_role;
grant execute on function private.is_admin() to anon,authenticated;
grant execute on function private.owns_seller(uuid) to anon,authenticated;
grant execute on function private.listing_visible(uuid) to anon,authenticated;
