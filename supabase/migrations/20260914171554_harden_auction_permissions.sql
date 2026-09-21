-- Private-schema USAGE is needed by RLS predicates, but must not grant access
-- to SECURITY DEFINER write helpers through PostgreSQL's PUBLIC defaults.
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
grant execute on function private.is_admin(), private.owns_seller(uuid), private.listing_visible(uuid) to anon, authenticated;

-- Apply the same deleted/draft visibility rule to direct table reads and RPCs.
alter policy auction_visibility on public.auctions using(private.listing_visible(listing_id));

create function public.set_watch(p_auction_id uuid, p_watching boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  a public.auctions%rowtype;
  v_changed integer;
begin
  if p_watching is null then raise exception 'Watching state is required'; end if;
  select * into a from public.auctions where id=p_auction_id for update;
  if not found or not private.listing_visible(a.listing_id) then
    raise exception 'Auction is not available' using errcode='42501';
  end if;
  if p_watching then
    insert into public.watchlists(user_id,auction_id) values(v_actor,a.id)
      on conflict(user_id,auction_id) do nothing;
  else
    delete from public.watchlists where user_id=v_actor and auction_id=a.id;
  end if;
  get diagnostics v_changed=row_count;
  if v_changed>0 then
    update public.auctions set
      watch_count=(select count(*) from public.watchlists w where w.auction_id=a.id),
      version=version+1,updated_at=clock_timestamp()
      where id=a.id returning * into a;
  end if;
  return jsonb_build_object('watching',p_watching,'watch_count',a.watch_count);
end $$;
revoke all on function public.set_watch(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_watch(uuid,boolean) to authenticated;

-- Keep the legacy toggle guarded for callers upgrading to set_watch.
create or replace function public.toggle_watch(p_auction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.actor(); v_watching boolean;
begin
  perform 1 from public.auctions where id=p_auction_id for update;
  v_watching:=exists(select 1 from public.watchlists where user_id=v_actor and auction_id=p_auction_id);
  return public.set_watch(p_auction_id,not v_watching);
end $$;

create or replace function public.place_bid(p_auction_id uuid,p_maximum bigint,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_listing uuid;
begin
  perform private.actor();
  select listing_id into v_listing from public.auctions where id=p_auction_id for update;
  if not found or not private.listing_visible(v_listing) then
    raise exception 'Auction is not available' using errcode='42501';
  end if;
  return private.auction_bid(p_auction_id,p_maximum,p_idempotency_key);
end $$;

create or replace function private.auction_settle_due(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record;v_count integer:=0;v_now timestamptz:=clock_timestamp();
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Batch limit must be between 1 and 100';
  end if;
  -- Already-live auctions that have time remaining must not crowd scheduled
  -- starts out of a bounded batch on every scheduler tick.
  for r in select id from public.auctions
    where (state='LIVE' and ends_at<=v_now) or (state='SCHEDULED' and starts_at<=v_now)
    order by ends_at,id limit p_limit loop
    perform private.auction_settle(r.id);v_count:=v_count+1;
  end loop;
  -- The auction-before-order lock order matches settlement and payment flows.
  for r in select auction_id,id from public.orders
    where status='AWAITING_PAYMENT' and payment_deadline<=v_now
    order by payment_deadline,id limit p_limit loop
    perform 1 from public.auctions where id=r.auction_id for update;
    perform 1 from public.orders where id=r.id for update;
    update public.orders set status='PAYMENT_FAILED',updated_at=v_now
      where id=r.id and status='AWAITING_PAYMENT' and payment_deadline<=clock_timestamp();
    if found then
      update public.auctions set state='PAYMENT_FAILED',version=version+1,updated_at=v_now where id=r.auction_id;
      insert into private.risk_flags(user_id,auction_id,flag,score)
        select buyer_id,r.auction_id,'unpaid_win',20 from public.orders where id=r.id;
    end if;
  end loop;
  return jsonb_build_object('processed',v_count,'server_time',clock_timestamp());
end $$;

-- Closing is a privileged scheduler action. Public catalogue reads never need
-- a write-capable scheduler grant, even though outcomes are deterministic.
revoke all on function public.settle_due(integer) from public,anon,authenticated;
grant execute on function public.settle_due(integer) to service_role;
