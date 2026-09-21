-- Admin listing and seller moderation. Reserve amounts stay off catalogue JSON.

create function public.moderate_listing(p_listing_id uuid, p_decision text, p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_admin uuid:=private.require_admin();
  v_listing public.listings%rowtype;
  v_auction public.auctions%rowtype;
  v_reserve bigint;
  v_category_slug text;
  v_next text;
  v_now timestamptz;
  v_seller_user uuid;
begin
  if p_decision is distinct from 'approve' and p_decision is distinct from 'reject' then
    raise exception 'Decision must be approve or reject' using errcode='P0001';
  end if;
  if p_listing_id is null then raise exception 'Listing not found' using errcode='P0001'; end if;
  select * into v_listing from public.listings where id=p_listing_id for update;
  if not found or v_listing.deleted_at is not null then
    raise exception 'Listing not found' using errcode='P0001';
  end if;
  select * into v_auction from public.auctions where listing_id=v_listing.id for update;
  if not found then raise exception 'Listing not found' using errcode='P0001'; end if;

  if p_decision='approve' and v_auction.state in ('SCHEDULED','LIVE') then
    return public.listing_editor(p_listing_id);
  end if;
  if p_decision='reject' and v_auction.state='REJECTED' then
    return public.listing_editor(p_listing_id);
  end if;
  if v_auction.state is distinct from 'PENDING_REVIEW' then
    raise exception 'This listing cannot be moderated in its current state' using errcode='P0001';
  end if;

  select sa.user_id into v_seller_user from private.seller_accounts sa where sa.seller_id=v_listing.seller_id;

  if p_decision='approve' then
    select r.reserve_price into v_reserve from private.auction_rules r where r.auction_id=v_auction.id;
    select c.slug into v_category_slug from public.categories c where c.id=v_listing.category_id;
    if char_length(v_listing.title) not between 5 and 140 then
      raise exception 'Title must be between 5 and 140 characters' using errcode='P0001';
    end if;
    if char_length(v_listing.description)<20 then
      raise exception 'Description must be at least 20 characters' using errcode='P0001';
    end if;
    if v_category_slug is null then
      raise exception 'A valid category is required' using errcode='P0001';
    end if;
    if v_listing.condition not in ('New','Like New','Excellent','Good','Fair','For Parts') then
      raise exception 'Condition is not valid' using errcode='P0001';
    end if;
    if coalesce(jsonb_array_length(v_listing.image_urls),0)<1 then
      raise exception 'At least one image is required' using errcode='P0001';
    end if;
    if exists(
      select 1 from jsonb_array_elements(v_listing.image_urls) t(elem)
      where jsonb_typeof(elem)<>'string'
         or ((elem#>>'{}') not like '/images/%' and (elem#>>'{}') not like '/api/uploads/%')
    ) then
      raise exception 'Each image must start with /images/ or /api/uploads/' using errcode='P0001';
    end if;
    if v_auction.starting_price<1 or v_auction.starting_price>9000000000000 then
      raise exception 'Starting price must be between 1 and 9000000000000' using errcode='P0001';
    end if;
    if v_reserve is not null and v_reserve<v_auction.starting_price then
      raise exception 'Reserve price must be at least the starting price' using errcode='P0001';
    end if;
    if v_auction.ends_at<=v_auction.starts_at then
      raise exception 'The auction must end after it starts' using errcode='P0001';
    end if;
    if v_auction.ends_at<v_auction.starts_at+interval '24 hours'
       or v_auction.ends_at>v_auction.starts_at+interval '14 days' then
      raise exception 'Auction duration must be between 24 hours and 14 days' using errcode='P0001';
    end if;
    if v_auction.shipping_price<0 or v_auction.shipping_price>10000000 then
      raise exception 'Shipping price must be between 0 and 10000000' using errcode='P0001';
    end if;

    v_now:=clock_timestamp();
    if v_auction.ends_at<=v_now then
      raise exception 'This listing expired while awaiting review' using errcode='P0001';
    end if;
    if v_auction.starts_at<=v_now then v_next:='LIVE';
    else v_next:='SCHEDULED';
    end if;

    update public.auctions
      set state=v_next,version=version+1,updated_at=clock_timestamp()
      where id=v_auction.id;
    perform private.audit(v_admin,'listing_approved',v_listing.id,trim(p_reason));
    if v_seller_user is not null then
      perform private.notify(
        v_seller_user,
        'listing_approved',
        'listing_approved:'||v_listing.id::text,
        'Listing approved',
        'Your listing is scheduled or live.',
        '/selling/'||v_listing.id::text
      );
    end if;
  else
    update public.auctions
      set state='REJECTED',version=version+1,updated_at=clock_timestamp()
      where id=v_auction.id;
    perform private.audit(v_admin,'listing_rejected',v_listing.id,trim(p_reason));
    if v_seller_user is not null then
      perform private.notify(
        v_seller_user,
        'listing_rejected',
        'listing_rejected:'||v_listing.id::text,
        'Listing not approved',
        left('Your listing was not approved. '||trim(p_reason),500),
        '/selling/'||v_listing.id::text
      );
    end if;
  end if;

  return public.listing_editor(p_listing_id);
end $$;

create function public.moderate_seller(p_seller_id uuid, p_decision text, p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_admin uuid:=private.require_admin();
  v_seller public.seller_profiles%rowtype;
  v_user uuid;
  v_status text;
begin
  if p_decision is distinct from 'approve' and p_decision is distinct from 'reject' then
    raise exception 'Decision must be approve or reject' using errcode='P0001';
  end if;
  if p_seller_id is null then raise exception 'Seller not found' using errcode='P0001'; end if;
  select * into v_seller from public.seller_profiles where id=p_seller_id for update;
  if not found then raise exception 'Seller not found' using errcode='P0001'; end if;

  if p_decision='approve' and v_seller.verification_status='verified' then
    return jsonb_build_object(
      'id',v_seller.id,'shop_name',v_seller.shop_name,'city',v_seller.city,'province',v_seller.province,
      'verification_status',v_seller.verification_status,'verified',true
    );
  end if;
  if p_decision='reject' and v_seller.verification_status='rejected' then
    return jsonb_build_object(
      'id',v_seller.id,'shop_name',v_seller.shop_name,'city',v_seller.city,'province',v_seller.province,
      'verification_status',v_seller.verification_status,'verified',false
    );
  end if;
  if v_seller.verification_status is distinct from 'pending' then
    raise exception 'This seller cannot be moderated in its current state' using errcode='P0001';
  end if;

  if p_decision='approve' then v_status:='verified'; else v_status:='rejected'; end if;
  update public.seller_profiles
    set verification_status=v_status,updated_at=clock_timestamp()
    where id=v_seller.id
    returning * into v_seller;
  perform private.audit(
    v_admin,
    case when p_decision='approve' then 'seller_approved' else 'seller_rejected' end,
    v_seller.id,
    trim(p_reason)
  );
  select sa.user_id into v_user from private.seller_accounts sa where sa.seller_id=v_seller.id;
  if v_user is not null then
    if p_decision='approve' then
      perform private.notify(
        v_user,'seller_approved','seller_approved:'||v_seller.id::text,
        'Seller application approved','Your seller account has been verified.','/selling'
      );
    else
      perform private.notify(
        v_user,'seller_rejected','seller_rejected:'||v_seller.id::text,
        'Seller application not approved',
        left('Your seller application was not approved. '||trim(p_reason),500),
        '/selling'
      );
    end if;
  end if;
  return jsonb_build_object(
    'id',v_seller.id,'shop_name',v_seller.shop_name,'city',v_seller.city,'province',v_seller.province,
    'verification_status',v_seller.verification_status,'verified',v_seller.verification_status='verified'
  );
end $$;

revoke all on function public.moderate_listing(uuid,text,text) from public,anon,authenticated;
revoke all on function public.moderate_seller(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_listing(uuid,text,text) to authenticated;
grant execute on function public.moderate_seller(uuid,text,text) to authenticated;
