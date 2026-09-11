# Environment and local development

Infrastructure remains local by user instruction. No cloud project, paid service or deployment is provisioned. The separate Project Arena infrastructure is unrelated and must not be modified.

Install pinned dependencies with `npm.cmd ci`. Copy `.env.example` to `.env.local`, generate a random `LOCAL_AUTH_SECRET` of at least 32 characters, and run `npm.cmd run dev`. Bind the application to the loopback interface. Use the exact `APP_URL` origin in the browser. Local production-build verification is allowed with the same explicit local configuration.

`AUCTA_LOCAL_MODE=true` enables PGlite and fictional development identities only when `APP_URL` and incoming host headers are loopback addresses. Hosted platform markers and public forwarding headers disable this facility. The application never uses an unsigned cookie, localStorage profile or user-supplied role as identity. The local signed HTTP-only session expires after eight hours. The four development identities exercise buyer, competing buyer, seller and admin workflows; they are not real accounts or production credentials.

The database persists under `.local/aucta-db` by default. Keep `.local/` and `.env.local` out of Git. Set AUCTA_LOCAL_DATA_DIR to a child directory of .local for independent acceptance runs (an empty value uses the default); do not run concurrent application processes against one embedded database directory.

`PAYMENT_PROVIDER=mock` is explicit and local only. No money is collected. The mock provider and manual-shipping interfaces exist, but checkout, payment-state persistence, fulfillment and review mutation flows are not connected yet. Seeded completed orders are fictional fixtures, not evidence of that loop working.

## Future dedicated Supabase setup

Use a newly authorized AUCTA project. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and a HTTPS `APP_URL`; disable local mode and mock payments. Apply and audit the migrations before exposing the Data API. The app verifies server identity using Supabase Auth and obtains permissions from database records. It never trusts user metadata for authorization. Email OTP/magic-link and optional Google OAuth endpoints use PKCE and a same-origin callback. Configure the exact callback allowlist `/auth/callback`; the token-hash email flow uses `/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Configure SMTP and Google provider credentials in Supabase separately.

Production storage policies, upload scanning, Realtime publication/subscriptions, distributed abuse controls, scheduler, payment provider credentials/webhook signing and payout operations are separate launch gates. The local SQL and browser tests do not verify these cloud services. Missing production configuration returns an explicit unavailable response for protected operations.

`CRON_SECRET` protects `/api/cron/close` using a Bearer token. The route also requires a configured server-only Supabase service role key in hosted mode, or explicit local mode locally. Set an appropriate external polling cadence before launch; closing must run independently of open browsers. Never expose the service key to the client.
