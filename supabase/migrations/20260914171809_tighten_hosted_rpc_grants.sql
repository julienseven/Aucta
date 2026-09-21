-- Supabase-hosted projects grant anon/authenticated function execution by
-- default. Keep the public read surface explicit and require authentication
-- for every user mutation.

revoke execute on function public.dashboard() from public, anon;
revoke execute on function public.toggle_watch(uuid) from public, anon;
revoke execute on function public.place_bid(uuid,bigint,uuid) from public, anon;
revoke execute on function public.set_watch(uuid,boolean) from public, anon;
revoke execute on function public.listing_editor(uuid) from public, anon;
revoke execute on function public.apply_seller(text,text,text) from public, anon;
revoke execute on function public.save_listing_draft(uuid,jsonb) from public, anon;
revoke execute on function public.submit_listing(uuid) from public, anon;
revoke execute on function public.moderate_listing(uuid,text,text) from public, anon;
revoke execute on function public.moderate_seller(uuid,text,text) from public, anon;
revoke execute on function public.ship_order(uuid,text,text) from public, anon;
revoke execute on function public.confirm_received(uuid) from public, anon;
revoke execute on function public.review_order(uuid,integer,text) from public, anon;

drop policy participant_payouts on public.payouts;
create policy participant_payouts on public.payouts for select to authenticated
using(exists(
  select 1 from public.orders o
  where o.id=order_id and (o.seller_id=(select auth.uid()) or private.is_admin())
));
