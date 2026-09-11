-- Recreate auction_detail without a PL/pgSQL variable/alias clash on `a`.
create or replace function public.auction_detail(p_slug text) returns jsonb
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
grant execute on function public.auction_detail(text) to anon,authenticated;
