-- Hosted launch foundation: keep mock payment local, add real taxonomy, and
-- close due auctions every minute when pg_cron is available (Supabase hosted).

revoke execute on function public.pay_order(uuid,text) from public, anon, authenticated;

insert into public.categories(id,slug,name) values
  ('c0000000-0000-0000-0000-000000000001','watches','Watches'),
  ('c0000000-0000-0000-0000-000000000002','cameras','Cameras'),
  ('c0000000-0000-0000-0000-000000000003','cards','Trading Cards'),
  ('c0000000-0000-0000-0000-000000000004','sneakers','Sneakers'),
  ('c0000000-0000-0000-0000-000000000005','design','Design'),
  ('c0000000-0000-0000-0000-000000000006','gaming','Gaming')
on conflict (slug) do update set name=excluded.name;

do $$
begin
  if exists (select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cron$
      select cron.schedule(
        'aucta_settle_due',
        '* * * * *',
        'select public.settle_due(50);'
      )
    $cron$;
  end if;
end $$;
