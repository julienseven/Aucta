# AUCTA database contract and current model

Updated 24 September 2026. The adopted application uses Drizzle with PostgreSQL. `src/db/schema.ts` is the current schema source. Dedicated Supabase project `edlvglhxsbigsoubdauj` was observed with 16 empty Drizzle tables before connection work. That observation does not verify current constraints or permission acceptance.

## Current access model

The Next.js server connects through `DATABASE_URL` using a restricted application login. Anonymous/authenticated Supabase Data API table grants are disabled and all sixteen application tables have RLS enabled as defense in depth. No browser receives this login or database connection string. The application uses custom user/session authentication, not `auth.users` or Supabase Auth JWT identity.

Server handlers and transactions enforce authorization. An application database login can access multiple users' records; ordinary end-user access is constrained by the application, not automatically by a Supabase user JWT. Test these boundaries directly before launch.

The older `supabase/migrations` and PGlite test history belong to a different schema/RPC architecture. Do not replay them into this database. Record all adopted-schema changes as reviewable migrations; inspect hosted state before applying any destructive schema push.

## Required invariants

- UUID entity identities and UTC timestamps; integer IDR bounded below the JavaScript safe-integer limit.
- One current proxy ceiling per lot/bidder and one order per lot, enforced by database constraints.
- Private reserves and maxima never exposed through Data API grants or client DTOs.
- Same lot lock shared by bidding and closing; deadline rechecked after locking.
- Order lock shared by settlement and expiry; paid orders cannot become unpaid through a stale scan.
- Persistent, caller-scoped request and provider-event idempotency.
- Explicit role/admin/participant checks, immutable audit events and amount snapshots.
- Restrictive default privileges for new tables/sequences and tested restore procedures.

## Implementation and verification gaps

Server bidding and closing now order equivalent ceilings by timestamp and ID. Raises advance timestamp priority. Closing rechecks the locked deadline; expiry rechecks the locked status/deadline before related writes. Server pricing honors reserve floors while respecting the winning ceiling.

These code changes do not prove hosted negative permissions or concurrent behavior. Existing unit tests and mocked transaction tests are distinct from actual PostgreSQL tests. Database tests must use a disposable database and explicit opt-in; never run mutation fixtures against the production catalogue. Required acceptance includes constraint inspection, rejected direct writes, cross-user access, self-bids, suspended users and real simultaneous bidding/closing/payment races.
