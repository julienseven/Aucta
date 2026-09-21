-- Seller apply, drafts, submission, taxonomy, and owner/admin listing_editor.
-- Reserve amounts stay on private.auction_rules and listing_editor; never on auction_public_json.

create function public.taxonomy() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_categories jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name) order by c.name),'[]'::jsonb)
    into v_categories
    from public.categories c;
  return jsonb_build_object('categories',v_categories);
end $$;

create function public.listing_editor(p_listing_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  v_listing public.listings%rowtype;
  v_auction public.auctions%rowtype;
  v_rules private.auction_rules%rowtype;
  v_category_slug text;
begin
  if p_listing_id is null
     or not exists(
       select 1 from public.listings l
       join private.seller_accounts sa on sa.seller_id=l.seller_id
       where l.id=p_listing_id and sa.user_id=v_actor
     ) and not private.is_admin() then
    raise exception 'You cannot access this listing' using errcode='42501';
  end if;
  select * into v_listing from public.listings where id=p_listing_id;
  if not found then raise exception 'You cannot access this listing' using errcode='42501'; end if;
  select * into v_auction from public.auctions where listing_id=v_listing.id;
  if not found then raise exception 'Listing not found' using errcode='P0001'; end if;
  select * into v_rules from private.auction_rules where auction_id=v_auction.id;
  select c.slug into v_category_slug from public.categories c where c.id=v_listing.category_id;
  return jsonb_build_object(
    'listing_id',v_listing.id,
    'auction_id',v_auction.id,
    'slug',v_listing.slug,
    'state',v_auction.state,
    'title',v_listing.title,
    'category_slug',v_category_slug,
    'brand',v_listing.brand,
    'description',v_listing.description,
    'condition',v_listing.condition,
    'flaws',v_listing.flaws,
    'provenance',v_listing.provenance,
    'attributes',v_listing.attributes,
    'images',v_listing.image_urls,
    'starting_price',v_auction.starting_price,
    'reserve_price',v_rules.reserve_price,
    'increment_override',v_auction.increment_override,
    'starts_at',v_auction.starts_at,
    'ends_at',v_auction.ends_at,
    'shipping_price',v_auction.shipping_price,
    'sample',v_listing.sample
  );
end $$;

create function public.apply_seller(p_shop_name text, p_city text, p_province text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  v_shop text:=trim(p_shop_name);
  v_city text:=trim(p_city);
  v_province text:=trim(p_province);
  v_seller public.seller_profiles%rowtype;
begin
  if v_shop is null or char_length(v_shop) not between 2 and 80 then
    raise exception 'Shop name must be between 2 and 80 characters' using errcode='P0001';
  end if;
  if v_city is null or char_length(v_city) not between 2 and 80 then
    raise exception 'City must be between 2 and 80 characters' using errcode='P0001';
  end if;
  if v_province is null or char_length(v_province) not between 2 and 80 then
    raise exception 'Province must be between 2 and 80 characters' using errcode='P0001';
  end if;
  if exists(select 1 from private.seller_accounts where user_id=v_actor) then
    raise exception 'You already have a seller profile.' using errcode='P0001';
  end if;
  insert into public.seller_profiles(shop_name,city,province,verification_status)
    values(v_shop,v_city,v_province,'pending')
    returning * into v_seller;
  insert into private.seller_accounts(seller_id,user_id) values(v_seller.id,v_actor);
  update private.account_roles
    set role='seller',updated_at=clock_timestamp()
    where user_id=v_actor and role='buyer';
  insert into private.audit_logs(actor_id,action,subject_id,context)
    values(v_actor,'seller_applied',v_seller.id,jsonb_build_object('shop_name',v_seller.shop_name));
  return jsonb_build_object(
    'id',v_seller.id,
    'shop_name',v_seller.shop_name,
    'city',v_seller.city,
    'province',v_seller.province,
    'verification_status',v_seller.verification_status,
    'verified',false
  );
end $$;

create function public.save_listing_draft(p_listing_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  v_seller_id uuid;
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_listing public.listings%rowtype;
  v_auction public.auctions%rowtype;
  v_title text:='Untitled lot';
  v_description text:='';
  v_condition text:='Good';
  v_brand text:='';
  v_flaws text:='';
  v_provenance text:='';
  v_attributes jsonb:='{}'::jsonb;
  v_images jsonb:='[]'::jsonb;
  v_category_id uuid;
  v_starting bigint:=1000000;
  v_reserve bigint:=null;
  v_increment bigint:=null;
  v_starts timestamptz:=clock_timestamp();
  v_ends timestamptz:=v_starts+interval '7 days';
  v_shipping bigint:=0;
  v_slug text;
  v_base text;
  v_i integer:=0;
begin
  if jsonb_typeof(v_payload)<>'object' then
    raise exception 'Listing payload must be an object' using errcode='P0001';
  end if;
  select sa.seller_id into v_seller_id from private.seller_accounts sa where sa.user_id=v_actor;
  if not found then raise exception 'A seller profile is required.' using errcode='42501'; end if;

  if p_listing_id is not null then
    select * into v_listing from public.listings where id=p_listing_id for update;
    if not found or v_listing.deleted_at is not null then
      raise exception 'Listing not found' using errcode='P0001';
    end if;
    if v_listing.seller_id is distinct from v_seller_id then
      raise exception 'You do not own this listing' using errcode='42501';
    end if;
    select * into v_auction from public.auctions where listing_id=v_listing.id for update;
    if not found then raise exception 'Listing not found' using errcode='P0001'; end if;
    if v_auction.state not in ('DRAFT','REJECTED') then
      raise exception 'Only draft or rejected listings can be saved' using errcode='P0001';
    end if;
    v_title:=v_listing.title;
    v_description:=v_listing.description;
    v_condition:=v_listing.condition;
    v_brand:=v_listing.brand;
    v_flaws:=v_listing.flaws;
    v_provenance:=v_listing.provenance;
    v_attributes:=v_listing.attributes;
    v_images:=v_listing.image_urls;
    v_category_id:=v_listing.category_id;
    v_starting:=v_auction.starting_price;
    v_increment:=v_auction.increment_override;
    v_starts:=v_auction.starts_at;
    v_ends:=v_auction.ends_at;
    v_shipping:=v_auction.shipping_price;
    select r.reserve_price into v_reserve from private.auction_rules r where r.auction_id=v_auction.id;
  else
    select c.id into v_category_id from public.categories c order by c.name limit 1;
    if v_category_id is null then raise exception 'A valid category is required' using errcode='P0001'; end if;
  end if;

  if v_payload ? 'title' then
    v_title:=coalesce(nullif(trim(v_payload->>'title'),''),'Untitled lot');
  end if;
  if char_length(v_title) not between 3 and 140 then
    raise exception 'Title must be between 3 and 140 characters' using errcode='P0001';
  end if;
  if v_payload ? 'description' then v_description:=coalesce(v_payload->>'description',''); end if;
  if v_payload ? 'condition' and v_payload->'condition' is not null then
    v_condition:=trim(v_payload->>'condition');
  end if;
  if v_condition not in ('New','Like New','Excellent','Good','Fair','For Parts') then
    raise exception 'Condition is not valid' using errcode='P0001';
  end if;
  if v_payload ? 'brand' then v_brand:=coalesce(trim(v_payload->>'brand'),''); end if;
  if v_payload ? 'flaws' then v_flaws:=coalesce(v_payload->>'flaws',''); end if;
  if v_payload ? 'provenance' then v_provenance:=coalesce(v_payload->>'provenance',''); end if;
  if v_payload ? 'attributes' then
    if v_payload->'attributes' is null or jsonb_typeof(v_payload->'attributes')<>'object' then
      raise exception 'Attributes must be an object' using errcode='P0001';
    end if;
    v_attributes:=v_payload->'attributes';
  end if;
  if v_payload ? 'category_slug' and nullif(trim(v_payload->>'category_slug'),'') is not null then
    select c.id into v_category_id from public.categories c where c.slug=lower(trim(v_payload->>'category_slug'));
    if not found then raise exception 'A valid category is required' using errcode='P0001'; end if;
  end if;
  if v_payload ? 'images' then
    if v_payload->'images' is null or jsonb_typeof(v_payload->'images')<>'array' then
      raise exception 'Images must be an array' using errcode='P0001';
    end if;
    v_images:=v_payload->'images';
    if jsonb_array_length(v_images)>8 then
      raise exception 'Listings can include at most 8 images' using errcode='P0001';
    end if;
    if exists(
      select 1 from jsonb_array_elements(v_images) t(elem)
      where jsonb_typeof(elem)<>'string'
         or ((elem#>>'{}') not like '/images/%' and (elem#>>'{}') not like '/api/uploads/%')
    ) then
      raise exception 'Each image must start with /images/ or /api/uploads/' using errcode='P0001';
    end if;
  end if;
  if v_payload ? 'starting_price' and v_payload->'starting_price' is not null then
    v_starting:=(v_payload->>'starting_price')::bigint;
  end if;
  if v_starting<1 or v_starting>9000000000000 then
    raise exception 'Starting price must be between 1 and 9000000000000' using errcode='P0001';
  end if;
  if v_payload ? 'reserve_price' then
    if v_payload->'reserve_price' is null then v_reserve:=null;
    else v_reserve:=(v_payload->>'reserve_price')::bigint;
    end if;
  end if;
  if v_reserve is not null and (v_reserve<1 or v_reserve>9000000000000 or v_reserve<v_starting) then
    raise exception 'Reserve price must be at least the starting price' using errcode='P0001';
  end if;
  if v_payload ? 'increment_override' then
    if v_payload->'increment_override' is null then v_increment:=null;
    else v_increment:=(v_payload->>'increment_override')::bigint;
    end if;
  end if;
  if v_increment is not null and (v_increment<1 or v_increment>1000000000) then
    raise exception 'Increment override must be between 1 and 1000000000' using errcode='P0001';
  end if;
  if v_payload ? 'starts_at' and v_payload->'starts_at' is not null then
    v_starts:=(v_payload->>'starts_at')::timestamptz;
  end if;
  if v_payload ? 'ends_at' and v_payload->'ends_at' is not null then
    v_ends:=(v_payload->>'ends_at')::timestamptz;
  end if;
  if v_ends<=v_starts then
    raise exception 'The auction must end after it starts' using errcode='P0001';
  end if;
  if v_payload ? 'shipping_price' then
    if v_payload->'shipping_price' is null then v_shipping:=0;
    else v_shipping:=(v_payload->>'shipping_price')::bigint;
    end if;
  end if;
  if v_shipping<0 or v_shipping>10000000 then
    raise exception 'Shipping price must be between 0 and 10000000' using errcode='P0001';
  end if;

  if p_listing_id is null then
    v_slug:=lower(v_title);
    v_slug:=regexp_replace(v_slug,'[^a-z0-9]+','-','g');
    v_slug:=trim(both '-' from v_slug);
    v_slug:=left(v_slug,80);
    if v_slug='' then v_slug:='lot'; end if;
    v_base:=v_slug;
    while exists(select 1 from public.listings where slug=v_slug) loop
      v_i:=v_i+1;
      if v_i>16 then raise exception 'Could not allocate a unique listing slug' using errcode='P0001'; end if;
      v_slug:=left(v_base,71)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
    end loop;
    insert into public.listings(
      seller_id,category_id,brand,slug,title,description,condition,flaws,provenance,attributes,image_urls,sample
    ) values (
      v_seller_id,v_category_id,v_brand,v_slug,v_title,v_description,v_condition,v_flaws,v_provenance,v_attributes,v_images,false
    ) returning * into v_listing;
    insert into public.auctions(
      listing_id,state,starts_at,ends_at,starting_price,current_price,shipping_price,
      increment_override,has_reserve,reserve_met,sample
    ) values (
      v_listing.id,'DRAFT',v_starts,v_ends,v_starting,v_starting,v_shipping,
      v_increment,v_reserve is not null,v_reserve is null,false
    ) returning * into v_auction;
    insert into private.auction_rules(auction_id,reserve_price) values(v_auction.id,v_reserve);
  else
    update public.listings set
      title=v_title,category_id=v_category_id,brand=v_brand,description=v_description,condition=v_condition,
      flaws=v_flaws,provenance=v_provenance,attributes=v_attributes,image_urls=v_images,updated_at=clock_timestamp()
      where id=v_listing.id;
    update public.auctions set
      starting_price=v_starting,current_price=v_starting,shipping_price=v_shipping,increment_override=v_increment,
      starts_at=v_starts,ends_at=v_ends,has_reserve=v_reserve is not null,reserve_met=v_reserve is null,
      updated_at=clock_timestamp()
      where id=v_auction.id;
    update private.auction_rules set reserve_price=v_reserve where auction_id=v_auction.id;
  end if;

  delete from public.listing_images where listing_id=v_listing.id;
  insert into public.listing_images(listing_id,storage_path,sort_order)
    select v_listing.id,t.img,(t.ord-1)::integer
    from jsonb_array_elements_text(v_images) with ordinality as t(img,ord);

  return public.listing_editor(v_listing.id);
end $$;

create function public.submit_listing(p_listing_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=private.actor();
  v_seller_id uuid;
  v_listing public.listings%rowtype;
  v_auction public.auctions%rowtype;
  v_reserve bigint;
  v_category_slug text;
begin
  select sa.seller_id into v_seller_id from private.seller_accounts sa where sa.user_id=v_actor;
  if not found then raise exception 'A seller profile is required.' using errcode='42501'; end if;
  if p_listing_id is null then raise exception 'Listing not found' using errcode='P0001'; end if;
  select * into v_listing from public.listings where id=p_listing_id for update;
  if not found or v_listing.deleted_at is not null then
    raise exception 'Listing not found' using errcode='P0001';
  end if;
  if v_listing.seller_id is distinct from v_seller_id then
    raise exception 'You do not own this listing' using errcode='42501';
  end if;
  select * into v_auction from public.auctions where listing_id=v_listing.id for update;
  if not found then raise exception 'Listing not found' using errcode='P0001'; end if;
  if v_auction.state='PENDING_REVIEW' then
    return public.listing_editor(v_listing.id);
  end if;
  if v_auction.state not in ('DRAFT','REJECTED') then
    raise exception 'Only draft or rejected listings can be submitted' using errcode='P0001';
  end if;
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
  if v_auction.starts_at<clock_timestamp()-interval '5 minutes' then
    raise exception 'Start time cannot be more than 5 minutes in the past' using errcode='P0001';
  end if;
  if v_auction.shipping_price<0 or v_auction.shipping_price>10000000 then
    raise exception 'Shipping price must be between 0 and 10000000' using errcode='P0001';
  end if;

  update public.auctions
    set state='PENDING_REVIEW',version=version+1,updated_at=clock_timestamp()
    where id=v_auction.id;
  insert into private.audit_logs(actor_id,action,subject_id,context)
    values(v_actor,'listing_submitted',v_listing.id,jsonb_build_object('auction_id',v_auction.id));
  perform private.notify(
    v_actor,
    'listing_submitted',
    'listing_submitted:'||v_listing.id::text,
    'Listing submitted for review',
    'Your listing is awaiting review.',
    '/selling'
  );
  return public.listing_editor(v_listing.id);
end $$;

revoke all on function public.taxonomy() from public,anon,authenticated;
revoke all on function public.listing_editor(uuid) from public,anon,authenticated;
revoke all on function public.apply_seller(text,text,text) from public,anon,authenticated;
revoke all on function public.save_listing_draft(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.submit_listing(uuid) from public,anon,authenticated;
grant execute on function public.taxonomy() to anon,authenticated;
grant execute on function public.listing_editor(uuid) to authenticated;
grant execute on function public.apply_seller(text,text,text) to authenticated;
grant execute on function public.save_listing_draft(uuid,jsonb) to authenticated;
grant execute on function public.submit_listing(uuid) to authenticated;
