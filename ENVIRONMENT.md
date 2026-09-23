# AUCTA environment

The adopted application reads `DATABASE_URL` from its server environment. The hosted value points to the AUCTA Supabase transaction pooler with the restricted `aucta_app` database login. Never commit or print its password. The server verifies Supabase's Root 2021 CA from `certs/supabase-prod-ca-2021.crt`. The app uses custom signed sessions, not Supabase Auth.

`AUCTA_SECRET` signs sessions and must be at least 32 random characters. `NEXT_PUBLIC_BASE_URL` must match the deployed HTTPS origin. `AUCTA_DEMO_MODE=true` enables fictional seeds and preview sign-in codes only on non-production localhost. `PAYMENT_PROVIDER=manual` is development-only; production currently uses `disabled`. `MIDTRANS_SERVER_KEY` enables Midtrans only when `PAYMENT_PROVIDER=midtrans`. SMTP requires `SMTP_HOST` and related sender/login values. Without SMTP, hosted email sign-in fails closed.

`DISABLE_SCHEDULER=true` disables the process-local interval on Vercel. `CRON_SECRET` secures `/api/cron/close`; an independent production scheduler has not yet been connected. PostgreSQL integration tests use only an explicitly isolated `TEST_DATABASE_URL`. Sample data must never be seeded into production. See DEPLOYMENT.md for project identifiers and launch gates.
