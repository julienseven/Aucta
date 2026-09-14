-- Fictional AUCTA development inventory. Not real objects, people, shops or sales.
do $$
declare
  v_now timestamptz:=clock_timestamp();
  v_seller uuid:='00000000-0000-0000-0000-000000000001';
  v_buyer uuid:='00000000-0000-0000-0000-000000000002';
  v_rival uuid:='00000000-0000-0000-0000-000000000003';
  v_admin uuid:='00000000-0000-0000-0000-000000000004';
  v_shop uuid:='11111111-0000-0000-0000-000000000001';
  v_cat_watches uuid:='c0000000-0000-0000-0000-000000000001';
  v_cat_cameras uuid:='c0000000-0000-0000-0000-000000000002';
  v_cat_cards uuid:='c0000000-0000-0000-0000-000000000003';
  v_cat_sneakers uuid:='c0000000-0000-0000-0000-000000000004';
  v_cat_design uuid:='c0000000-0000-0000-0000-000000000005';
  v_cat_gaming uuid:='c0000000-0000-0000-0000-000000000006';
  v_list_watch uuid:='aaaaaaaa-0000-0000-0000-000000000001';
  v_list_camera uuid:='aaaaaaaa-0000-0000-0000-000000000002';
  v_list_cards uuid:='aaaaaaaa-0000-0000-0000-000000000003';
  v_list_sneakers uuid:='aaaaaaaa-0000-0000-0000-000000000004';
  v_list_design uuid:='aaaaaaaa-0000-0000-0000-000000000005';
  v_list_gaming uuid:='aaaaaaaa-0000-0000-0000-000000000006';
  v_auc_watch uuid:='bbbbbbbb-0000-0000-0000-000000000001';
  v_auc_camera uuid:='bbbbbbbb-0000-0000-0000-000000000002';
  v_auc_cards uuid:='bbbbbbbb-0000-0000-0000-000000000003';
  v_auc_sneakers uuid:='bbbbbbbb-0000-0000-0000-000000000004';
  v_auc_design uuid:='bbbbbbbb-0000-0000-0000-000000000005';
  v_auc_gaming uuid:='bbbbbbbb-0000-0000-0000-000000000006';
  v_order uuid:='dddddddd-0000-0000-0000-000000000001';
  v_review uuid:='eeeeeeee-0000-0000-0000-000000000001';
  v_hammer bigint:=25000000;
  v_ship bigint:=185000;
  v_buyer_fee bigint:=0;
  v_seller_fee bigint;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values
    (v_seller,'seller@aucta.local',v_now-interval '40 days',jsonb_build_object('display_name','Raka Studio'),v_now-interval '40 days'),
    (v_buyer,'buyer@aucta.local',v_now-interval '20 days',jsonb_build_object('display_name','Nadia'),v_now-interval '20 days'),
    (v_rival,'competitor@aucta.local',v_now-interval '18 days',jsonb_build_object('display_name','Aditya'),v_now-interval '18 days'),
    (v_admin,'admin@aucta.local',v_now-interval '60 days',jsonb_build_object('display_name','Admin'),v_now-interval '60 days');

  update private.account_roles set role='seller',updated_at=v_now where user_id=v_seller;
  update private.account_roles set role='admin',updated_at=v_now where user_id=v_admin;

  insert into public.seller_profiles(id,shop_name,city,province,verification_status,created_at,updated_at)
    values(v_shop,'Raka Studio','Bandung','West Java','verified',v_now-interval '40 days',v_now);
  insert into private.seller_accounts(seller_id,user_id) values(v_shop,v_seller);

  insert into public.categories(id,slug,name,created_at) values
    (v_cat_watches,'watches','Watches',v_now),
    (v_cat_cameras,'cameras','Cameras',v_now),
    (v_cat_cards,'cards','Trading Cards',v_now),
    (v_cat_sneakers,'sneakers','Sneakers',v_now),
    (v_cat_design,'design','Design',v_now),
    (v_cat_gaming,'gaming','Gaming',v_now)
    on conflict (slug) do nothing;

  insert into public.listings(id,seller_id,category_id,brand,slug,title,description,condition,flaws,provenance,attributes,image_urls,sample,created_at,updated_at) values
    (v_list_watch,v_shop,v_cat_watches,'Seiko','seiko-6139-pogue-chronograph','Seiko 6139-6005 “Pogue” chronograph',
     'Fictional development lot. Automatic chronograph inspired by a well-known 1970s reference. Not a real object or sale.',
     'Excellent','Hairline on the case back. Aftermarket strap.','Private collection, Bandung.',
     '{"year":"1973","movement":"Automatic chronograph","case":"41mm steel"}'::jsonb,
     '["/images/chronograph.png","/images/watch.png"]'::jsonb,true,v_now-interval '5 days',v_now),
    (v_list_camera,v_shop,v_cat_cameras,'Hasselblad','hasselblad-500cm-planar','Hasselblad 500C/M with 80mm Planar',
     'Fictional development lot. Medium-format body and standard lens for catalogue and anti-snipe tests. Not a real object or sale.',
     'Good','Brassing on the winding crank. Light seals replaced in the storyline.',
     'Studio kit, fictional.',
     '{"format":"6x6","lens":"80mm Planar"}'::jsonb,
     '["/images/medium-format.png","/images/camera.png"]'::jsonb,true,v_now-interval '2 days',v_now),
    (v_list_cards,v_shop,v_cat_cards,'Pokémon','pokemon-base-charizard-holo','1999 Pokémon Base Set Charizard Holo',
     'Fictional development lot. Scheduled upcoming auction. Not a real card or sale.',
     'Like New','Centering slightly east in the storyline.','Fictional binder page.',
     '{"set":"Base Set","number":"4/102"}'::jsonb,
     '["/images/cards.png"]'::jsonb,true,v_now-interval '1 day',v_now),
    (v_list_sneakers,v_shop,v_cat_sneakers,'Jordan','air-jordan-1-chicago-1994','Air Jordan 1 Chicago 1994',
     'Fictional development lot. Completed sale used to exercise orders, shipping and reviews. Not a real pair or sale.',
     'Good','Creasing on the toe box. Replacement laces.','Fictional archive.',
     '{"size":"US 9","year":"1994"}'::jsonb,
     '["/images/sneakers.png"]'::jsonb,true,v_now-interval '12 days',v_now),
    (v_list_design,v_shop,v_cat_design,'Herman Miller','eames-lounge-chair-walnut','Eames lounge chair, walnut',
     'Fictional development lot. Closed no-sale because the hidden reserve was not met. Not a real chair or sale.',
     'Excellent','Light wear on the ottoman edge.','Fictional interior.',
     '{"material":"Walnut and leather"}'::jsonb,
     '["/images/design.png"]'::jsonb,true,v_now-interval '9 days',v_now),
    (v_list_gaming,v_shop,v_cat_gaming,'Nintendo','nintendo-game-boy-dmg-01','Nintendo Game Boy DMG-01',
     'Fictional development lot. Live auction with a reserve that has not been met. Not a real console or sale.',
     'Fair','Yellowed housing. Screen polarizer cloudy.','Fictional childhood drawer.',
     '{"model":"DMG-01"}'::jsonb,
     '["/images/gaming.png"]'::jsonb,true,v_now-interval '2 days',v_now);

  insert into public.auctions(id,listing_id,state,starts_at,ends_at,starting_price,current_price,shipping_price,bid_count,bidder_count,watch_count,has_reserve,reserve_met,featured,sample,created_at,updated_at) values
    (v_auc_watch,v_list_watch,'LIVE',v_now-interval '20 hours',v_now+interval '2 days',1250000,1650000,85000,2,2,2,false,true,true,true,v_now-interval '5 days',v_now),
    (v_auc_camera,v_list_camera,'LIVE',v_now-interval '3 hours',v_now+interval '90 seconds',8500000,8600000,150000,1,1,1,false,true,false,true,v_now-interval '2 days',v_now),
    (v_auc_cards,v_list_cards,'SCHEDULED',v_now+interval '2 days',v_now+interval '5 days',900000,900000,45000,0,0,0,false,true,false,true,v_now-interval '1 day',v_now),
    (v_auc_sneakers,v_list_sneakers,'COMPLETED',v_now-interval '10 days',v_now-interval '3 days',25000000,25000000,v_ship,1,1,0,false,true,false,true,v_now-interval '12 days',v_now-interval '2 days'),
    (v_auc_design,v_list_design,'NO_SALE',v_now-interval '8 days',v_now-interval '1 day',8500000,8500000,220000,0,0,0,true,false,false,true,v_now-interval '9 days',v_now-interval '1 day'),
    (v_auc_gaming,v_list_gaming,'LIVE',v_now-interval '12 hours',v_now+interval '3 days',1250000,1250000,65000,1,1,0,true,false,false,true,v_now-interval '2 days',v_now);

  insert into private.auction_rules(auction_id,reserve_price,winning_user_id) values
    (v_auc_watch,null,v_buyer),
    (v_auc_camera,null,v_buyer),
    (v_auc_cards,null,null),
    (v_auc_sneakers,null,v_buyer),
    (v_auc_design,20000000,null),
    (v_auc_gaming,3000000,v_rival);

  insert into private.proxy_bids(auction_id,bidder_id,maximum,created_at,updated_at) values
    (v_auc_watch,v_rival,1600000,v_now-interval '6 hours',v_now-interval '6 hours'),
    (v_auc_watch,v_buyer,2000000,v_now-interval '5 hours',v_now-interval '5 hours'),
    (v_auc_camera,v_buyer,9000000,v_now-interval '30 minutes',v_now-interval '30 minutes'),
    (v_auc_sneakers,v_buyer,25000000,v_now-interval '4 days',v_now-interval '4 days'),
    (v_auc_gaming,v_rival,1800000,v_now-interval '3 hours',v_now-interval '3 hours');

  insert into public.bids(auction_id,bidder_alias,amount,automatic,created_at) values
    (v_auc_watch,'Bidder '||upper(substr(md5(v_auc_watch::text||v_rival::text),1,6)),1250000,false,v_now-interval '6 hours'),
    (v_auc_watch,'Bidder '||upper(substr(md5(v_auc_watch::text||v_buyer::text),1,6)),1650000,false,v_now-interval '5 hours'),
    (v_auc_camera,'Bidder '||upper(substr(md5(v_auc_camera::text||v_buyer::text),1,6)),8600000,false,v_now-interval '30 minutes'),
    (v_auc_sneakers,'Bidder '||upper(substr(md5(v_auc_sneakers::text||v_buyer::text),1,6)),25000000,false,v_now-interval '4 days'),
    (v_auc_gaming,'Bidder '||upper(substr(md5(v_auc_gaming::text||v_rival::text),1,6)),1250000,false,v_now-interval '3 hours');

  insert into public.watchlists(user_id,auction_id,created_at) values
    (v_buyer,v_auc_watch,v_now-interval '8 hours'),
    (v_rival,v_auc_watch,v_now-interval '7 hours'),
    (v_buyer,v_auc_camera,v_now-interval '1 hour');

  v_seller_fee:=(v_hammer*700+5000)/10000;
  insert into public.orders(id,auction_id,buyer_id,seller_id,status,winning_bid,buyer_fee,seller_fee,shipping_amount,total,seller_net,payment_deadline,address,created_at,updated_at,completed_at)
    values(
      v_order,v_auc_sneakers,v_buyer,v_seller,'COMPLETED',v_hammer,v_buyer_fee,v_seller_fee,v_ship,
      v_hammer+v_buyer_fee+v_ship,v_hammer-v_seller_fee,
      v_now-interval '2 days',
      jsonb_build_object('name','Nadia','phone','+6281100000002','line1','Jl. Fiktif 12','city','Jakarta','province','DKI Jakarta','postal_code','12110'),
      v_now-interval '3 days',v_now-interval '2 days',v_now-interval '2 days'
    );

  insert into public.shipments(order_id,carrier,tracking_number,shipped_at,received_at,created_at,updated_at)
    values(v_order,'JNE','AUCTA-FICTIONAL-001',v_now-interval '2 days 12 hours',v_now-interval '2 days',v_now-interval '2 days 12 hours',v_now-interval '2 days');

  insert into public.reviews(id,order_id,author_alias,recipient_seller_id,rating,body,created_at)
    values(v_review,v_order,'Nadia',v_shop,5,'Fictional review for local development. Packed carefully and described accurately.',v_now-interval '2 days');
  insert into private.review_authors(review_id,order_id,author_id,recipient_id)
    values(v_review,v_order,v_buyer,v_seller);

  insert into public.notifications(user_id,type,dedupe_key,title,message,href,payload,created_at) values
    (v_rival,'outbid','outbid:'||v_auc_watch::text||':seed','You have been outbid','A new bidder is leading. Your maximum remains private.','/auction/seiko-6139-pogue-chronograph',
     jsonb_build_object('title','You have been outbid','message','A new bidder is leading. Your maximum remains private.','href','/auction/seiko-6139-pogue-chronograph'),
     v_now-interval '5 hours'),
    (v_buyer,'auction_won','won:'||v_auc_sneakers::text,'You won the auction','Fictional completed payment for local development.','/orders/'||v_order::text,
     jsonb_build_object('title','You won the auction','message','Fictional completed payment for local development.','href','/orders/'||v_order::text),
     v_now-interval '3 days'),
    (v_seller,'payment_required','sold:'||v_auc_sneakers::text,'Your auction has a winner','Fictional completed sale for local development.','/orders/'||v_order::text,
     jsonb_build_object('title','Your auction has a winner','message','Fictional completed sale for local development.','href','/orders/'||v_order::text),
     v_now-interval '3 days');
end $$;
