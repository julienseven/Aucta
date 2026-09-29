# AUCTA deployment

Dedicated Supabase project: `edlvglhxsbigsoubdauj` (Singapore). Dedicated Vercel project: `aucta`, ID `prj_BVMbN29i6wlwq07UTciF1MCcYhTN`, team `julienseven`. Project Arena infrastructure is unrelated.

AUCTA uses Drizzle over PostgreSQL and custom signed sessions. It does not use Supabase Auth. All 16 current public tables have RLS enabled; `anon` and `authenticated` lack table access. The server has a restricted `aucta_app` login. `drizzle/0002_server_database_access.sql` records the access policy. The credential is never committed. A separate `aucta_test` schema supports disposable hosted acceptance tests.

The Vercel production environment has `DATABASE_URL`, `AUCTA_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`, `AUCTA_DEMO_MODE=false`, `PAYMENT_PROVIDER=disabled`, and `DISABLE_SCHEDULER=true`. The database URL uses the verified Singapore transaction pooler on port 6543. The app bundles the Supabase Root 2021 CA and verifies the TLS server certificate. No Supabase browser key or service-role key is needed for this version.

The deployment must remain a non-transactional preview until SMTP delivery, a real Midtrans integration, a durable close/expiry scheduler, real inventory, and end-to-end two-user/provider acceptance are complete. Vercel Hobby cron cannot meet this auction's close cadence. The authenticated `/api/cron/close` route is available for a suitable scheduler but no production schedule is configured. Do not claim automatic closing while it is absent.

Use `npm.cmd ci`, typecheck, lint, PostgreSQL integration tests using an isolated database/schema, and build before deploying. Then verify `/api/health`, catalogue behavior, unauthenticated write denial, and production logs. Live payment and SMTP secrets should be set only when the corresponding providers have been configured and tested.

## Midtrans sandbox progress — 28 September 2026

The registered Aucta merchant's **sandbox** server key is stored only in the ignored local `.env.local`. A read-only status request authenticated successfully, and a synthetic Rp10,000 Snap transaction returned a sandbox checkout token. The application code now locks and reuses one checkout attempt per order, verifies signed whole-IDR payment status against that attempt, reconciles pending payments before expiry, and waits for confirmed gateway refunds before recording them complete. Checkout and expiry transitions were exercised against the isolated `aucta_test` PostgreSQL schema.

The hosted `PAYMENT_PROVIDER` remains disabled. No Midtrans notification URL, hosted sandbox key, real buyer checkout, refund, or payout has been verified. A durable close/expiry scheduler and SMTP are still required before live transactions. Do not set `MIDTRANS_IS_PRODUCTION=true` or enable hosted payments based on the sandbox token test alone.

## Scheduler preparation — 29 September 2026

The authenticated `/api/cron/close` endpoint is ready for repeated calls. Its auction start and close passes now process at most 25 due lots per invocation, so later calls drain a backlog. A Supabase Cron job using `pg_cron` and `pg_net` can call this endpoint every minute, with `CRON_SECRET` held in Supabase Vault. Configure that job only in the dedicated AUCTA project, then inspect `cron.job_run_details`, `net._http_response`, and the AUCTA logs to verify successful calls and retry behavior. A read-only query through the restricted app connection found Vault installed, but `pg_cron` and `pg_net` are not enabled; the connected Supabase tool denied project access. No hosted job has been installed or verified. Keep hosted transactions disabled until it is.

Hosted sign-in also remains unavailable. The deployment URL `aucta-two.vercel.app` is not an owned sending domain; configure an owned domain and SMTP sender before testing two real inboxes. The planned domain is `aucta.id`, which has not been registered yet.
