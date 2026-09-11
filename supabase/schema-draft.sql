-- AUCTA: integer IDR, private proxy ceilings, row-locked auction authority.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;
revoke create on schema public from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(char_length(display_name) between 1 and 80),
  locale text not null default 'en-ID',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table private.account_roles (
  user_id uuid primary key references public.profiles(id),
  role text not null default 'buyer' check(role in ('buyer','seller','admin')),
  suspended boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
create table private.settings (key text primary key,value text not null);
create table public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null check(char_length(shop_name) between 2 and 80),
  city text not null, province text not null,
  verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table private.seller_accounts (
  seller_id uuid primary key references public.seller_profiles(id),
  user_id uuid not null unique references public.profiles(id)
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  recipient_name text not null,phone text not null,line1 text not null,city text not null,province text not null,postal_code text not null,
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index addresses_user_idx on public.addresses(user_id);
create table public.categories (id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,created_at timestamptz not null default clock_timestamp());
create table public.brands (id uuid primary key default gen_random_uuid(),category_id uuid references public.categories(id),slug text not null unique,name text not null,created_at timestamptz not null default clock_timestamp());
create index brands_category_idx on public.brands(category_id);
create table public.listings (
  id uuid primary key default gen_random_uuid(),seller_id uuid not null references public.seller_profiles(id),category_id uuid not null references public.categories(id),
  brand text not null default '',slug text not null unique,title text not null check(char_length(title) between 3 and 140),
  description text not null default '',condition text not null default 'Good' check(condition in ('New','Like New','Excellent','Good','Fair','For Parts')),
  flaws text not null default '',provenance text not null default '',attributes jsonb not null default '{}',image_urls jsonb not null default '[]',
  sample boolean not null default false,deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index listings_seller_idx on public.listings(seller_id);
create index listings_category_idx on public.listings(category_id);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id),storage_path text not null,sort_order integer not null,
  created_at timestamptz not null default clock_timestamp(),unique(listing_id,sort_order)
);
create table public.listing_attributes (
  id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.listings(id),name text not null,value text not null,
  created_at timestamptz not null default clock_timestamp(),unique(listing_id,name)
);
create table public.auctions (
  id uuid primary key default gen_random_uuid(),listing_id uuid not null unique references public.listings(id),
  state text not null default 'DRAFT' check(state in ('DRAFT','PENDING_REVIEW','SCHEDULED','LIVE','ENDED','AWAITING_PAYMENT','PAID','FULFILLMENT','COMPLETED','REJECTED','CANCELLED','NO_SALE','PAYMENT_FAILED','DISPUTED','REFUNDED')),
  starts_at timestamptz not null,ends_at timestamptz not null check(ends_at > starts_at),
  starting_price bigint not null check(starting_price between 1 and 9000000000000),
  current_price bigint not null check(current_price between 1 and 9000000000000),
  shipping_price bigint not null default 0 check(shipping_price between 0 and 100000000),
  increment_override bigint check(increment_override between 1 and 1000000000),
  bid_count integer not null default 0,bidder_count integer not null default 0,watch_count integer not null default 0,
  has_reserve boolean not null default false,reserve_met boolean not null default true,
  extension_count integer not null default 0,version bigint not null default 1,featured boolean not null default false,sample boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index auctions_closing_idx on public.auctions(state,ends_at);
create table private.auction_rules (
  auction_id uuid primary key references public.auctions(id),reserve_price bigint check(reserve_price between 1 and 9000000000000),
  winning_user_id uuid references public.profiles(id)
);
create index auction_rules_winner_idx on private.auction_rules(winning_user_id);
create sequence private.bid_priority;
create table private.proxy_bids (
  auction_id uuid not null references public.auctions(id),bidder_id uuid not null references public.profiles(id),
  maximum bigint not null check(maximum between 1 and 9000000000000),priority bigint not null default nextval('private.bid_priority'),
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),primary key(auction_id,bidder_id)
);
create index proxy_bids_bidder_idx on private.proxy_bids(bidder_id);
create index proxy_bids_rank_idx on private.proxy_bids(auction_id,maximum desc,priority);
create table public.bids (
  id uuid primary key default gen_random_uuid(),auction_id uuid not null references public.auctions(id),bidder_alias text not null,
  amount bigint not null check(amount between 1 and 9000000000000),automatic boolean not null default false,created_at timestamptz not null default clock_timestamp()
);
create index bids_activity_idx on public.bids(auction_id,created_at desc);
create table private.bid_requests (
  auction_id uuid not null references public.auctions(id),bidder_id uuid not null references public.profiles(id),idempotency_key uuid not null,
  maximum bigint not null,response jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(auction_id,bidder_id,idempotency_key)
);
create index bid_requests_bidder_idx on private.bid_requests(bidder_id);
create table public.watchlists (user_id uuid not null references public.profiles(id),auction_id uuid not null references public.auctions(id),created_at timestamptz not null default clock_timestamp(),primary key(user_id,auction_id));
create index watchlists_auction_idx on public.watchlists(auction_id);
create table public.orders (
  id uuid primary key default gen_random_uuid(),auction_id uuid not null unique references public.auctions(id),buyer_id uuid not null references public.profiles(id),seller_id uuid not null references public.profiles(id),
  status text not null check(status in ('AWAITING_PAYMENT','PAID','FULFILLMENT','COMPLETED','PAYMENT_FAILED','DISPUTED','REFUNDED','CANCELLED')),
  winning_bid bigint not null check(winning_bid between 1 and 9000000000000),buyer_fee bigint not null default 0,seller_fee bigint not null,
  shipping_amount bigint not null,total bigint not null,seller_net bigint not null,
  currency text not null default 'IDR' check(currency='IDR'),payment_deadline timestamptz not null,address jsonb,
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
  check(buyer_id<>seller_id),check(total=winning_bid+buyer_fee+shipping_amount),check(seller_net=winning_bid-seller_fee)
);
create index orders_buyer_idx on public.orders(buyer_id);
create index orders_seller_idx on public.orders(seller_id);
create index orders_deadline_idx on public.orders(status,payment_deadline);
create table public.payments (
  id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),provider text not null,
  provider_reference text unique,idempotency_key text not null unique,amount bigint not null,status text not null check(status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table private.payment_events (provider text not null,event_id text not null,order_id uuid not null references public.orders(id),created_at timestamptz not null default clock_timestamp(),primary key(provider,event_id));
create index payment_events_order_idx on private.payment_events(order_id);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),provider text not null,provider_reference text unique,
  idempotency_key text not null unique,amount bigint not null,status text not null check(status in ('pending','paid','held','failed')),
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table public.shipments (
  id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),carrier text not null,tracking_number text not null,
  shipped_at timestamptz not null default clock_timestamp(),received_at timestamptz,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),
  author_alias text not null,recipient_seller_id uuid references public.seller_profiles(id),rating integer not null check(rating between 1 and 5),body text not null check(char_length(body) between 2 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index reviews_order_idx on public.reviews(order_id);
create index reviews_recipient_idx on public.reviews(recipient_seller_id);
create table private.review_authors (review_id uuid primary key references public.reviews(id),order_id uuid not null references public.orders(id),author_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),unique(order_id,author_id));
create index review_authors_author_idx on private.review_authors(author_id);
create index review_authors_recipient_idx on private.review_authors(recipient_id);
create table public.disputes (
  id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id),initiator_id uuid not null references public.profiles(id),
  reason text not null check(char_length(reason) between 5 and 2000),evidence jsonb not null default '[]',status text not null default 'open' check(status in ('open','resolved_refund','resolved_resume')),
  previous_status text not null,resolution_reason text,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index disputes_initiator_idx on public.disputes(initiator_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),type text not null,dedupe_key text not null unique,
  title text not null,message text not null,href text,payload jsonb not null default '{}',read_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create table private.email_outbox (
  notification_id uuid primary key references public.notifications(id),status text not null default 'pending' check(status in ('pending','sent','failed')),attempts integer not null default 0,created_at timestamptz not null default clock_timestamp()
);
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.profiles(id),action text not null,subject_id uuid not null,reason text not null,context jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index admin_actions_actor_idx on public.admin_actions(actor_id);
create table private.audit_logs (
  id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),action text not null,subject_id uuid not null,context jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index audit_logs_actor_idx on private.audit_logs(actor_id);
create table public.reports (
  id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id),listing_id uuid not null references public.listings(id),reason text not null check(char_length(reason) between 5 and 2000),status text not null default 'open' check(status in ('open','reviewed','dismissed')),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_listing_idx on public.reports(listing_id);
create table private.risk_flags (
  id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id),auction_id uuid references public.auctions(id),flag text not null,score integer not null check(score between 0 and 100),context jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index risk_flags_user_idx on private.risk_flags(user_id);
create index risk_flags_auction_idx on private.risk_flags(auction_id);

-- Bootstrap only neutral profile fields from Auth; metadata can never grant a role.
create function private.on_auth_user_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'display_name',80),''),'Collector'));
  insert into private.account_roles(user_id) values(new.id);
  return new;
end $$;
create trigger aucta_auth_profile after insert on auth.users for each row execute function private.on_auth_user_created();
create function private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from public.profiles p join private.account_roles r on r.user_id=p.id join auth.users u on u.id=p.id where p.id=v_id and not r.suspended and u.email_confirmed_at is not null) then
    raise exception 'Verified, active sign-in required' using errcode='42501';
  end if;
  return v_id;
end $$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.account_roles where user_id=auth.uid() and role='admin' and not suspended)
$$;
create function private.owns_seller(p_seller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.seller_accounts where seller_id=p_seller_id and user_id=auth.uid())
$$;
create function private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); begin
  if not private.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return v_actor;
end $$;
create function private.increment(p_price bigint,p_override bigint default null) returns bigint language sql immutable set search_path='' as $$
  select coalesce(p_override,case when p_price<1000000 then 25000 when p_price<5000000 then 50000 when p_price<20000000 then 100000 else 250000 end)::bigint
$$;
create function private.notify(p_user uuid,p_type text,p_key text,p_title text,p_message text,p_href text) returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; begin
  insert into public.notifications(user_id,type,dedupe_key,title,message,href) values(p_user,p_type,p_key,p_title,p_message,p_href) on conflict(dedupe_key) do nothing returning id into v_id;
  if v_id is not null then insert into private.email_outbox(notification_id) values(v_id); end if;
end $$;
create function private.audit(p_actor uuid,p_action text,p_subject uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
  if char_length(trim(p_reason))<5 then raise exception 'A meaningful moderation reason is required'; end if;
  insert into public.admin_actions(actor_id,action,subject_id,reason) values(p_actor,p_action,p_subject,p_reason);
  insert into private.audit_logs(actor_id,action,subject_id,context) values(p_actor,p_action,p_subject,jsonb_build_object('reason',p_reason));
end $$;

-- Every exposed table is RLS protected; no application role receives direct writes.
do $$ declare r record; begin
  for r in select schemaname,tablename from pg_tables where schemaname in ('public','private') loop
    execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
    execute format('revoke all on %I.%I from anon, authenticated',r.schemaname,r.tablename);
  end loop;
end $$;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy public_seller on public.seller_profiles for select to anon,authenticated using(true);
create policy own_address on public.addresses for select to authenticated using(user_id=(select auth.uid()));
create policy public_categories on public.categories for select to anon,authenticated using(true);
create policy public_brands on public.brands for select to anon,authenticated using(true);
create policy auction_visibility on public.auctions for select to anon,authenticated using(
  state not in ('DRAFT','PENDING_REVIEW','REJECTED') or private.is_admin() or exists(select 1 from public.listings l where l.id=listing_id and private.owns_seller(l.seller_id))
);
-- Do not query auctions through listings' policy, which would recurse through auctions' owner check.
create function private.listing_visible(p_listing uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.listings l join public.auctions a on a.listing_id=l.id where l.id=p_listing and l.deleted_at is null and (a.state not in ('DRAFT','PENDING_REVIEW','REJECTED') or private.owns_seller(l.seller_id) or private.is_admin()))
$$;
create policy listing_visibility on public.listings for select to anon,authenticated using(private.listing_visible(id));
create policy images_visibility on public.listing_images for select to anon,authenticated using(private.listing_visible(listing_id));
create policy attributes_visibility on public.listing_attributes for select to anon,authenticated using(private.listing_visible(listing_id));
create policy bid_visibility on public.bids for select to anon,authenticated using(exists(select 1 from public.auctions a where a.id=auction_id));
create policy own_watchlist on public.watchlists for select to authenticated using(user_id=(select auth.uid()));
create policy participant_orders on public.orders for select to authenticated using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()) or private.is_admin());
create policy participant_payments on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create policy participant_payouts on public.payouts for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.seller_id=auth.uid() or private.is_admin())));
create policy participant_shipments on public.shipments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create policy public_reviews on public.reviews for select to anon,authenticated using(true);
create policy participant_disputes on public.disputes for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create policy own_notifications on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy admin_actions_read on public.admin_actions for select to authenticated using(private.is_admin());
create policy own_reports on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or private.is_admin());
grant select on public.categories,public.brands,public.seller_profiles,public.listings,public.listing_images,public.listing_attributes,public.auctions,public.bids,public.reviews to anon,authenticated;
grant select on public.profiles,public.addresses,public.watchlists,public.orders,public.payments,public.payouts,public.shipments,public.disputes,public.notifications,public.admin_actions,public.reports to authenticated;

create function private.auction_bid(p_auction_id uuid,p_maximum bigint,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor(); a public.auctions%rowtype; r private.auction_rules%rowtype;
  v_now timestamptz; v_old_max bigint; v_old_winner uuid; v_top private.proxy_bids%rowtype; v_second private.proxy_bids%rowtype;
  v_price bigint; v_minimum bigint; v_extended boolean:=false; v_leader_raise boolean:=false; v_result jsonb; v_existing private.bid_requests%rowtype;
begin
  select * into a from public.auctions where id=p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  v_now:=clock_timestamp();
  if exists(select 1 from public.listings l join private.seller_accounts s on s.seller_id=l.seller_id where l.id=a.listing_id and s.user_id=v_actor) then raise exception 'Sellers cannot bid on their own auctions' using errcode='42501'; end if;
  if p_idempotency_key is null or p_maximum is null or p_maximum<1 or p_maximum>9000000000000 then raise exception 'Invalid maximum or idempotency key'; end if;
  select * into v_existing from private.bid_requests where auction_id=a.id and bidder_id=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.maximum<>p_maximum then raise exception 'Idempotency key already used with a different maximum'; end if;
    return v_existing.response;
  end if;
  if a.state='SCHEDULED' and a.starts_at<=v_now and a.ends_at>v_now then
    update public.auctions set state='LIVE' where id=a.id returning * into a;
  end if;
  if a.state<>'LIVE' or v_now<a.starts_at or v_now>=a.ends_at then raise exception 'Auction is not open for bidding'; end if;
  select * into r from private.auction_rules where auction_id=a.id;
  v_old_winner:=r.winning_user_id;
  select maximum into v_old_max from private.proxy_bids where auction_id=a.id and bidder_id=v_actor;
  v_leader_raise:=coalesce(v_old_winner=v_actor,false);
  if v_leader_raise then
    if p_maximum<=v_old_max then raise exception 'Increase your existing maximum'; end if;
  else
    v_minimum:=case when a.bid_count=0 then a.starting_price else a.current_price+private.increment(a.current_price,a.increment_override) end;
    if p_maximum<v_minimum or (v_old_max is not null and p_maximum<=v_old_max) then raise exception 'Maximum is below the minimum bid of %',v_minimum; end if;
  end if;
  insert into private.proxy_bids(auction_id,bidder_id,maximum,updated_at) values(a.id,v_actor,p_maximum,v_now)
  on conflict(auction_id,bidder_id) do update set maximum=excluded.maximum,priority=nextval('private.bid_priority'),updated_at=excluded.updated_at;
  select * into v_top from private.proxy_bids where auction_id=a.id order by maximum desc,priority asc limit 1;
  select * into v_second from private.proxy_bids where auction_id=a.id order by maximum desc,priority asc offset 1 limit 1;
  v_price:=greatest(a.starting_price,a.current_price);
  if v_second.bidder_id is not null then v_price:=greatest(v_price,least(v_top.maximum,v_second.maximum+private.increment(v_second.maximum,a.increment_override))); end if;
  if r.reserve_price is not null and v_top.maximum>=r.reserve_price then v_price:=greatest(v_price,r.reserve_price); end if;
  v_price:=least(v_top.maximum,v_price);
  if not v_leader_raise and a.ends_at-v_now<=interval '120 seconds' then v_extended:=true; end if;
  update private.auction_rules set winning_user_id=v_top.bidder_id where auction_id=a.id;
  update public.auctions set current_price=v_price,
    reserve_met=(r.reserve_price is null or v_top.maximum>=r.reserve_price),
    bid_count=bid_count+case when v_leader_raise then 0 else 1 end,
    bidder_count=(select count(*) from private.proxy_bids where auction_id=a.id),
    ends_at=ends_at+case when v_extended then interval '120 seconds' else interval '0' end,
    extension_count=extension_count+case when v_extended then 1 else 0 end,
    version=version+1,updated_at=v_now where id=a.id returning * into a;
  if not v_leader_raise then
    insert into public.bids(auction_id,bidder_alias,amount,automatic,created_at) values(a.id,'Bidder '||upper(substr(md5(a.id::text||v_top.bidder_id::text),1,6)),v_price,v_top.bidder_id<>v_actor,v_now);
  end if;
  if v_old_winner is not null and v_old_winner<>v_top.bidder_id then
    perform private.notify(v_old_winner,'outbid','outbid:'||a.id||':'||a.version,'You have been outbid','A new bidder is leading. Your maximum remains private.','/auction/'||(select slug from public.listings where id=a.listing_id));
  end if;
  if (select count(*) from private.bid_requests where bidder_id=v_actor and created_at>v_now-interval '1 minute')>=10 then
    insert into private.risk_flags(user_id,auction_id,flag,score) values(v_actor,a.id,'bid_velocity',30);
  end if;
  if p_maximum>=100000000 and exists(select 1 from public.profiles where id=v_actor and created_at>v_now-interval '7 days') then
    insert into private.risk_flags(user_id,auction_id,flag,score) values(v_actor,a.id,'new_account_large_bid',25);
  end if;
  v_result:=jsonb_build_object('auction',to_jsonb(a),'own_maximum',p_maximum,'is_leading',v_top.bidder_id=v_actor,'extended',v_extended,'server_time',v_now);
  insert into private.bid_requests(auction_id,bidder_id,idempotency_key,maximum,response) values(a.id,v_actor,p_idempotency_key,p_maximum,v_result);
  insert into private.audit_logs(actor_id,action,subject_id,context) values(v_actor,'bid_accepted',a.id,jsonb_build_object('price',v_price,'version',a.version,'extended',v_extended));
  return v_result;
end $$;

create function private.auction_settle(p_auction_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.auctions%rowtype;r private.auction_rules%rowtype;o public.orders%rowtype;v_now timestamptz;v_seller uuid;v_fee bigint;
begin
  -- Settlement is deterministic and safe to trigger publicly. Eligibility remains database-authoritative.
  select * into a from public.auctions where id=p_auction_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if a.state in ('DRAFT','PENDING_REVIEW','REJECTED') then raise exception 'Auction is not published'; end if;
  v_now:=clock_timestamp();
  if a.state='SCHEDULED' and a.starts_at<=v_now and a.ends_at>v_now then
    update public.auctions set state='LIVE',version=version+1,updated_at=v_now where id=a.id returning * into a;
  end if;
  if a.state not in ('LIVE','SCHEDULED') or a.ends_at>v_now then return jsonb_build_object('auction',to_jsonb(a),'settled',a.state not in ('LIVE','SCHEDULED'),'server_time',v_now); end if;
  select * into r from private.auction_rules where auction_id=a.id;
  if r.winning_user_id is null or not a.reserve_met then
    update public.auctions set state='NO_SALE',version=version+1,updated_at=v_now where id=a.id returning * into a;
  else
    select s.user_id into v_seller from public.listings l join private.seller_accounts s on s.seller_id=l.seller_id where l.id=a.listing_id;
    v_fee:=(a.current_price*700+5000)/10000;
    insert into public.orders(auction_id,buyer_id,seller_id,status,winning_bid,buyer_fee,seller_fee,shipping_amount,total,seller_net,payment_deadline)
      values(a.id,r.winning_user_id,v_seller,'AWAITING_PAYMENT',a.current_price,0,v_fee,a.shipping_price,a.current_price+a.shipping_price,a.current_price-v_fee,v_now+interval '24 hours')
      on conflict(auction_id) do nothing;
    select * into o from public.orders where auction_id=a.id;
    update public.auctions set state='AWAITING_PAYMENT',version=version+1,updated_at=v_now where id=a.id returning * into a;
    perform private.notify(o.buyer_id,'auction_won','won:'||a.id,'You won the auction','Payment is due within 24 hours.','/orders/'||o.id);
    perform private.notify(o.seller_id,'payment_required','sold:'||a.id,'Your auction has a winner','The buyer has been invited to pay.','/orders/'||o.id);
  end if;
  insert into private.audit_logs(action,subject_id,context) values('auction_settled',a.id,jsonb_build_object('state',a.state));
  -- No order UUID or participant identity in this public response.
  return jsonb_build_object('auction',to_jsonb(a),'settled',true,'server_time',v_now);
end $$;

create function private.auction_settle_due(p_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;v_count integer:=0;v_now timestamptz:=clock_timestamp();begin
  if p_limit<1 or p_limit>100 then raise exception 'Batch limit must be between 1 and 100'; end if;
  for r in select id from public.auctions where state in ('LIVE','SCHEDULED') and starts_at<=v_now order by ends_at limit p_limit loop
    perform private.auction_settle(r.id);v_count:=v_count+1;
  end loop;
  -- Lock auctions before orders everywhere to prevent a settlement/payment deadlock.
  for r in select auction_id,id from public.orders where status='AWAITING_PAYMENT' and payment_deadline<=v_now order by payment_deadline limit p_limit loop
    perform 1 from public.auctions where id=r.auction_id for update;
    perform 1 from public.orders where id=r.id for update;
    update public.orders set status='PAYMENT_FAILED',updated_at=v_now where id=r.id and status='AWAITING_PAYMENT' and payment_deadline<=clock_timestamp();
    if found then
      update public.auctions set state='PAYMENT_FAILED',version=version+1,updated_at=v_now where id=r.auction_id;
      insert into private.risk_flags(user_id,auction_id,flag,score) select buyer_id,r.auction_id,'unpaid_win',20 from public.orders where id=r.id;
    end if;
  end loop;
  return jsonb_build_object('processed',v_count,'server_time',clock_timestamp());
end $$;
