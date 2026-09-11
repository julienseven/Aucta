# AUCTA — implementation handoff

Updated 11 September 2026 after M4 listing/seller moderation.

## User decisions that persist

- Keep infrastructure **local only**. Do not create cloud projects, deploy, or modify the unrelated Project Arena Supabase/Vercel resources.
- Continue the product in DIRECTION.md / PRODUCT.md. Auction first, English first, integer IDR; no wallet or pretend escrow.
- Parallel agents are authorized, with separate ownership. Root integrates. Do not claim MVP completion from the catalogue UI.
- The audit began before the first Git commit, so it assessed the working tree rather than a recoverable Grok commit diff. Use git log and git status for the current commit state.

## Where the product stands

| Milestone | Actual state |
| --- | --- |
| M0 contract | Documents and domain/schema design exist. |
| M1 foundation | Local Next.js app, PGlite migrations/seed, signed development sessions, navigation and public catalogue work. Supabase SSR/auth code is prepared; hosted auth is unverified and intentionally not provisioned. |
| M2 auction core | SQL bidding, proxy competition, reserve, extension, idempotency, settlement/order creation, watchlists and sanitized detail work locally. Auction detail polls its own endpoint every five seconds while LIVE and visible. A protected closing endpoint exists; no durable recurring scheduler is installed. True multi-connection PostgreSQL concurrency and Supabase Realtime remain unverified. |
| M3 seller | Seller onboarding, listing drafts, autosave and submit exist locally. Submitted lots stay PENDING_REVIEW until an admin decision. |
| M4 moderation | Admin can approve or reject listings and seller applications with a required reason. Approve publishes a lot (`SCHEDULED` or `LIVE`); reject returns it to an editable `REJECTED` state. Decisions write `admin_actions` and `audit_logs` via `private.audit` and notify the seller. Reports, disputes and account suspension still have no mutation endpoints. |
| M5 transactions | Settlement creates orders. Payment and shipping interfaces exist, but checkout/payment persistence, fulfillment, receipt and review mutations are not connected. Completed seed transactions are fictional fixtures. |
| M6 polish | Editorial UI, mobile layout, filters, sold archive and basic metadata exist. Further accessibility, SEO (sitemap/robots/structured data), gallery zoom/swipe and comprehensive empty/loading states remain. |
| M7 launch | Not done. Local audit coverage has improved; cloud infrastructure, real concurrency, durable scheduling and the full seller-to-review loop are still gates. |

## Audit fixes applied

- Replaced stale client navbar identity with verified server props; login/logout broadcasts refresh other tabs and return destinations survive email/Google requests.
- Added a no-cache /api/auctions/[id] read endpoint and an auction-scoped visible-tab polling UI. Bid activity, price, own maximum/leading status and extensions refresh. Connection failures are visible.
- Fixed detail-page grid placement and narrow-screen bidding controls. Accepted bids show feedback. Uncertain retries retain the same idempotency key.
- Watch API now honors the requested watching state through set_watch. Retries no longer toggle a watch off or inflate counters. Account watch rows are deduplicated.
- Removed unpaid AWAITING_PAYMENT results from sold listings. Preserved safe notification links and centralized UI minimum-increment mapping.
- Added migration 20260910070304_harden_auction_permissions.sql: revoked untrusted execution of private write helpers, enforced deleted/draft visibility on auction reads/writes, bounded closing batches, prevented scheduled-start starvation, and limited closing to service_role.
- Added a dedicated cookie-free Supabase scheduler client and serialized local service-role transaction. User sessions cannot run the closing RPC.
- Tightened local Host parsing and redirect control-character validation. Provider sign-out failures are reported.
- Replaced the homepage's silent empty-catalogue fallback with an explicit error.
- Fixed the documented local database variable to AUCTA_LOCAL_DATA_DIR, restricted it to a child of .local, and excluded local data/environment files from production tracing.

## Important files

- src/lib/server/database.ts — migration runner, serialized identity/service transactions and local persistence.
- supabase/migrations/ — actual schema and controlled SQL; supabase/seed.sql is fictional.
- src/lib/server/marketplace.ts — allowlisted DTO mapping; repository.ts chooses local or Supabase RPCs.
- src/lib/auction/ — pure reference implementation with unit tests; real bids execute SQL.
- src/components/pages/auction-live.tsx and bid-controls.tsx — live display and bidding interactions. Bid controls render only while LIVE.
- src/components/pages/listing-writer.tsx, seller-apply-form.tsx, admin-desk.tsx, /sell, /selling, /selling/[id] and /admin — seller onboarding, draft writer and audited moderation desk.
- tests/database/security-regressions.test.ts and sql-engine.test.ts — real SQL behavior/permissions under PGlite.
- tests/services/ — request, auth, DTO and scheduler regressions.
- tests/e2e/marketplace.spec.ts — local browser flow and responsive regressions.
- playwright.config.ts — builds and starts an isolated server at localhost:3100 with a fresh .local/e2e-* database and generated in-memory test secret.

## Run locally

Use Node 22+ and npm.cmd on Windows.

1. npm.cmd ci
2. Configure .env.local from .env.example; generate LOCAL_AUTH_SECRET (32+ characters). Keep AUCTA_LOCAL_MODE=true and APP_URL=http://localhost:3000.
3. npm.cmd run dev; open http://localhost:3000.
4. Use the explicitly labeled Nadia (buyer), Aditya (rival), Raka Studio (seller), or Admin development identity.

After SQL changes, restart the application so its existing PGlite singleton applies new migrations. Never run two processes against the same embedded database directory. Do not delete the user's .local/aucta-db to make tests pass.

Checks: npm.cmd run typecheck; npm.cmd run lint; npm.cmd test; npm.cmd run build; npm.cmd run test:e2e.
Browser tests use installed Google Chrome and a separate origin/database, and build their server automatically. Reports/screenshots/traces are in ignored test-results/. No production authentication or money is exercised.

## Next work in order

1. Keep the current local checks green; inspect the verification results below.
2. Complete the remaining M2 acceptance infrastructure locally: reliable independent closing cadence and real PostgreSQL multi-connection concurrency tests when a local PostgreSQL/Docker runtime is available. PGlite queues requests and cannot prove row-lock contention between database sessions. M2 closer/concurrency still unverified.
3. Then the M5 mock-payment-to-review loop with provider-neutral idempotency. Reports/disputes/suspension remain later trust-safety work.
4. Finish polish and only revisit cloud setup when the user changes the local-only decision.

## Verification results

- Unit/service/database tests: **206 passed across 10 files** (11 September M4 integration). Includes seller apply/draft/submit, listing/seller moderate SQL, and negative permissions under PGlite.
- Typecheck: passed on 11 September after M4 integration.
- Lint: full project passed on 11 September with no warnings.
- Production build: passed on 11 September, including `/api/admin/listings/[id]` and `/api/admin/sellers/[id]`.
- Browser verification: **8 passed** (3.1m after a successful production build). Includes seller draft→submit (lot stays out of `/auctions` until approval), admin approve into the catalogue at 320px, and Nadia seller-desk application. Catalogue, auth, bidding, and self-bid scenarios still pass.
- Local HTTP smoke on the restarted `:3000` PGlite: Raka submit → `PENDING_REVIEW`; Admin `/admin` shows Approve (read-only copy gone); Nadia moderate 403; Admin approve → `LIVE`; `/auctions` includes the title.
- Browser scenarios check widths 320, 375, 390, 430, 768, 1280 and 1600; network-failure/recovery messaging; authenticated cookie navigation; cross-tab logout; anonymous and wrong-origin rejection; live prices; private maximum isolation; listing writer at 320px.
- Browser startup allowance is 15 minutes because the initial cold build exceeded five minutes on this machine. AUCTA_E2E_SKIP_BUILD=true is an optional test-only shortcut after a successful build. Every run still starts a fresh isolated database and server.
- Hosted Supabase Auth/Realtime/Storage, durable closing, and real multi-connection PostgreSQL concurrency remain unverified. Reports/disputes/suspension have no mutation endpoints. Checkout-to-review is not implemented.
