# AUCTA architecture

Updated 24 September 2026 for the adopted ZIP application.

## Runtime

- `src/app/`: Next.js App Router server pages and API handlers.
- `src/components/`: UI and client interactions; privileged decisions remain on the server.
- `src/db/schema.ts`: current Drizzle table definitions.
- `src/db/index.ts`: server PostgreSQL pool using `DATABASE_URL`.
- `src/lib/auth.ts`, `session-token.ts`: custom authentication and signed sessions.
- `src/lib/auctions.ts`, `close.ts`: transactional bidding and closing.
- `src/lib/payments/`: provider integration and settlement/order expiry.
- `src/app/api/cron/close/route.ts`: authenticated scheduled-work endpoint.

This implementation replaces the former PGlite and Supabase RPC application. Historical Supabase migrations describe that earlier model and must not be blindly applied to the current Drizzle database. Supabase Auth, client-side Supabase data access and Realtime are not wired into this application.

## Hosted boundary

Dedicated Supabase project: `edlvglhxsbigsoubdauj`. The server uses a restricted database login. Browser/Data API roles must have no table grants; RLS provides defense in depth. The server login has application privileges, so each handler must independently enforce identity, participant and admin authorization. RLS does not replace those checks for the privileged server connection.

Dedicated Vercel project: `aucta`, ID `prj_BVMbN29i6wlwq07UTciF1MCcYhTN`, team `julienseven`. The previous project link was stale/deleted. Never reuse Project Arena infrastructure.

## Transactions

Bids lock the lot row, validate eligibility and whole-IDR maximums, rank private ceilings and update the visible snapshot. Closing locks that same row and rechecks its deadline before settlement. Payment expiry locks and rechecks the order so a concurrently settled order cannot revert its lot to unsold. Equal maxima use chronological priority; ceiling raises receive a new priority.

Target hardening remains in AUCTION_ENGINE.md: database time, persistent idempotency, bounded jobs, transactional notification outbox, constraints and true multi-connection tests. App-clock checks and process-local request caches are not equivalents.

## External dependencies

Custom email authentication uses SMTP; optional Google OAuth needs separate application credentials. Midtrans is a provider adapter, not evidence of live payment acceptance. Hosted demo/manual payment fallbacks are disabled. Image storage/upload processing, payment refunds/payouts, distributed abuse controls and durable cron require acceptance work.

Production cannot rely on a process-local timer. `/api/cron/close` accepts authenticated GET/POST requests; its hosted schedule is pending. See DEPLOYMENT.md.
