-- AUCTA uses Drizzle from its server, not the Supabase Data API.
-- This migration closes the Data API and grants a dedicated non-bypass login
-- access to the existing application tables. The login password is provisioned
-- separately and is never stored in a migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aucta_app') THEN
    CREATE ROLE aucta_app NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO aucta_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aucta_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aucta_app;

DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('users','auth_tokens','lots','bids','bid_events','orders','payment_attempts','addresses','watchlist','notifications','reports','disputes','admin_events','email_outbox','followed_sellers','saved_searches')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY aucta_server_access ON public.%I FOR ALL TO aucta_app USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;
