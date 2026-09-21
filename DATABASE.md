# Database contract

UUID primary keys; `timestamptz` in UTC; consistent created/updated timestamps; FK indexes; integer IDR (`bigint`, bounded below JS safe integer). Private tables live in a non-exposed schema with defense-in-depth RLS. Public-schema tables all enable RLS. Application roles receive only required grants.

The following schema and access contract includes tables for future workflows. Their presence does not imply that seller, moderation, payment or fulfillment operations are implemented. Current executable operations and remaining acceptance gates are listed below.

| Entity | Principal fields and relationships | Access |
|---|---|---|
| profiles | auth user ID, display alias, locale | own record; public seller fields separated |
| seller_profiles | profile ID, shop name, city, province, verification | public safe fields; controlled onboarding/moderation |
| addresses | owner, delivery fields | owner, controlled order fulfillment |
| categories / brands | slug, name, category | public read, admin write |
| listings | seller, category, brand, slug, title, description, condition, flaws, provenance, attributes, deleted_at | published read; own drafts; controlled writes |
| listing_images / listing_attributes | listing, storage path, order / name, value | follow listing visibility |
| auctions | listing, state, start/end, public current price/counts, reserve-met flag, version | public sanitized read; no direct monetary mutation |
| private auction rules | auction, reserve, increments, winning user | private server functions only |
| bids | auction, public bidder alias, visible price, timestamp | safe public activity; immutable |
| proxy_bids | auction + bidder unique, ceiling, priority timestamp | private; owner-specific controlled retrieval |
| watchlists | owner + auction unique | owner |
| orders | unique auction, buyer, seller, immutable price/fee/shipping snapshot, status, deadline | participants; controlled transitions |
| payments / payouts | order, provider ref, idempotency key, amount, state | controlled participant reads and provider writes |
| shipments | unique order, carrier, tracking, shipped/received timestamps | participants; controlled fulfillment |
| reviews | order + author unique, recipient, rating 1–5, text | public; completed participants only |
| disputes | order, initiator, reason, evidence, state | participants and admin; audited resolution |
| notifications | owner, type, deduplication key, payload, read_at | owner |
| admin_actions / audit_logs | actor, action, subject, sanitized context | immutable, admin |
| reports / risk flags | reporter/subject, reason, score, status | own report/admin; no automatic bans |

Role/verification/suspension changes are privileged operations. Neither direct profile UPDATE nor auth metadata can grant admin access. Reserve and proxy ceilings are never on publicly selectable auction rows. Views use `security_invoker`; controlled security-definer functions use fixed search paths, explicit grants and identity checks. Private addresses are never exposed through seller catalogue data.

Order uniqueness on auction ID, proxy uniqueness on auction+bidder, payment provider-event uniqueness and review uniqueness provide database idempotency. An auction row lock is shared by bidding and closing so an expired auction cannot receive a bid while being settled.

Migrations and their executable tests are the source of truth; implementation deviations and launch gates must be recorded here.

## Local PGlite implementation notes

- `supabase/migrations/20260914171550_init.sql` is the schema-draft promotion (tables, RLS, `private.auction_bid` / `auction_settle` / `auction_settle_due`). Applied on PGlite 0.5.8 with no syntax patches.
- `supabase/migrations/20260914171552_rpcs.sql` adds public `security definer` RPCs with `search_path=''` and named `p_*` arguments. Its original grants are superseded by `20260914171554_harden_auction_permissions.sql`; use the effective permissions below rather than the historical migration in isolation.
- Catalogue JSON is allowlisted via `private.auction_public_json`. `listings` has no `subtitle` / `image_alt` columns; RPCs set `subtitle` from `brand` and `image_alt` from `title`. `sold_at` is not an auctions column; it is `orders.completed_at` or `orders.created_at` when an order exists. Seller `verified` is `verification_status = 'verified'` (lowercase in-row). `rating` / `completed_sales` are computed from `reviews` / completed `orders`.
- Fictional seed (`supabase/seed.sql`) uses `local-session.ts` UUIDs `…0001`–`…0004` with `auth.users.email_confirmed_at` set so `private.actor()` accepts them. Admin role is an `account_roles` update after the auth trigger. Sample slugs: `seiko-6139-pogue-chronograph` (LIVE featured), `hasselblad-500cm-planar` (LIVE, `ends_at = now + 90s`), `pokemon-base-charizard-holo` (SCHEDULED), `air-jordan-1-chicago-1994` (COMPLETED + order), `eames-lounge-chair-walnut` (NO_SALE, reserve unmet), `nintendo-game-boy-dmg-01` (LIVE, reserve unmet).
- In-memory PGlite apply (bootstrap + migrations + seed) succeeded. `catalogue()` as `anon` returned 6 auctions and no `reserve_price` key. `place_bid` as seller `…0001` on an own LIVE lot raised `Sellers cannot bid on their own auctions`.
- `20260914171553_auction_detail_alias.sql` recreates `public.auction_detail`. A PL/pgSQL row variable named `a` plus `FROM public.auctions a` made `a.listing_id` ambiguous. The lookup now aliases the table as `lot`.

## Current implementation after the local audit

After all migrations, the effective public RPC grants are:

- `catalogue` and `auction_detail`: `anon` and `authenticated`.
- `dashboard`, `place_bid`, `set_watch` and legacy `toggle_watch`: `authenticated`.
- `pay_order`, `ship_order`, `confirm_received`, `review_order`: `authenticated` (participant checks inside). `order_snapshot` is revoked from anon/authenticated and is only called by those security-definer functions.
- `settle_due`: `service_role` only; neither anonymous nor authenticated sessions, including application admins, can invoke it directly.

The permission-hardening migration revokes default private-function execution from PUBLIC, anon and authenticated, retaining only the three RLS predicates for untrusted roles. It also enforces listing visibility on auctions and watch/bid mutations, validates closing batch limits, and prevents live lots that have not expired from crowding due scheduled starts out of the closing batch. The application uses a separate server-only service client for hosted closing and a restricted service-role transaction in local mode.

Seller apply/draft/submit RPCs exist. `20260914171557_moderation_mutations.sql` adds public RPCs `moderate_listing` and `moderate_seller` (execute: authenticated; `private.require_admin()` inside). Approve moves `PENDING_REVIEW` to `SCHEDULED` or `LIVE` (LIVE when start has elapsed and the lot has not expired); reject moves it to `REJECTED`. Seller approve/reject only changes `verification_status` on `pending` rows. Both call `private.audit` (writes `admin_actions` and `audit_logs`) and notify the seller user. `20260914171559_order_mutations.sql` adds mock `pay_order`, `ship_order`, `confirm_received` and `review_order`. Trust mutations are described below. The closing operation exists. An opt-in process-local closer (`AUCTA_LOCAL_CLOSER=true`) calls `settle_due` every 15s; no durable hosted scheduler is configured.

PGlite tests execute the actual migrations under anon/authenticated/service roles. Requests within its single embedded connection are serialized; the 10/50/100-request tests are local correctness simulations, not proof of multi-connection PostgreSQL lock contention.

## Seller listing mutations

`20260914171556_seller_listing_mutations.sql` adds public RPCs `taxonomy()` (execute: anon, authenticated) and `apply_seller`, `save_listing_draft`, `submit_listing`, `listing_editor` (execute: authenticated). Submitted lots stay `PENDING_REVIEW` and remain out of `catalogue()` until `moderate_listing` approves them. `reserve_price` lives on `private.auction_rules` and is returned only by `listing_editor`; it is not added to `private.auction_public_json`.

## Trust and safety mutations

On 22 September 2026, the nine pre-existing migration files were renamed to match AUCTA's hosted `supabase_migrations.schema_migrations` versions. Each recorded SQL body was compared with its repository counterpart and matched after newline/outer-whitespace normalization. No historical SQL or remote history rows were changed. The local runner recognizes the legacy filenames so existing PGlite databases do not replay these migrations.

`20260921090000_trust_safety.sql` adds authenticated RPCs `report_listing`, `review_report`, `open_dispute`, `resolve_dispute`, `set_account_suspension`, `order_dispute` and `trust_safety_dashboard`. Each checks the active database identity; decisions/dashboard require an administrator, and dispute creation/read require an order participant (administrators may also read). Private helpers are not executable by untrusted roles.

Reports deduplicate an open report for the same collector/listing. Review/dismiss decisions are audited and do not automatically remove listings. Disputes lock auction then order, record PAID or FULFILLMENT as the previous state, and pause both records as DISPUTED. Resolution only restores that exact previous state and records an audited reason; no payment, refund or payout changes occur. The existing unique order constraint allows one dispute per order, including after resolution. Suspensions cannot target administrator accounts, do not rewrite bids/winners, and block subsequent active-identity operations. Repeated decisions are idempotent. Cloud migration and multi-connection verification remain unperformed.
