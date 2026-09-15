# AUCTA — implementation handoff

Updated 15 September 2026 after the UX principles implementation.

## UX implementation checkpoint

See UX_DESIGN.md for the reference-to-implementation mapping. Added a single private-maximum bid flow, semantic feedback, mobile filter disclosure, actual result counts, account next actions, order progress, receipt confirmation and truthful draft readiness. Auction summary now precedes long descriptions in document order; seller evidence and shipping sit beside the decision area.

Validation: typecheck, lint, 232 unit/database/service tests and production build passed. After updating bid selectors, the complete browser suite passed all 9 scenarios, including two-bidder competition and pay-to-review. Isolated cold-start reruns timed out on auction navigation after a successful authentication response; the full suite passed in 2.9 minutes. Mobile auction capture inspected. These results do not verify hosted dependencies or establish marketplace launch readiness.

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
| M2 auction core | SQL bidding, proxy competition, reserve, extension, idempotency, settlement/order creation, watchlists and sanitized detail work locally. Auction detail polls its own endpoint every five seconds while LIVE and visible. A protected closing endpoint exists. An opt-in process-local closer (`AUCTA_LOCAL_CLOSER=true` plus `CRON_SECRET`) ticks `settle_due` every 15s without a request store. That is not a durable hosted scheduler. True multi-connection PostgreSQL concurrency and Supabase Realtime remain unverified. |
| M3 seller | Seller onboarding, listing drafts, autosave and submit exist locally. Submitted lots stay PENDING_REVIEW until an admin decision. |
| M4 moderation | Admin can approve or reject listings and seller applications with a required reason. Approve publishes a lot (`SCHEDULED` or `LIVE`); reject returns it to an editable `REJECTED` state. Decisions write `admin_actions` and `audit_logs` via `private.audit` and notify the seller. Reports, disputes and account suspension still have no mutation endpoints. |
| M5 transactions | Local mock loop is connected: `pay_order` → `ship_order` → `confirm_received` → `review_order`. SQL is the order of record (lock auction, then order). Payments persist as `provider='mock'`; payouts stay `pending`. Seeded completed orders remain fictional fixtures. Real payment providers, webhooks, refunds and payouts are not implemented. |
| M6 polish | Editorial UI, mobile layout, filters, sold archive and basic metadata exist. Further accessibility, SEO (sitemap/robots/structured data), gallery zoom/swipe and comprehensive empty/loading states remain. |
| M7 launch | Not done. Local audit coverage has improved; cloud infrastructure, real concurrency, durable scheduling and a live payment provider are still gates. |

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
- Added migration 20260912013000_order_mutations.sql: buyer-only mock pay (idempotent key), seller-only ship, buyer receipt, buyer review completing the sale with a pending mock payout. `order_snapshot` is not executable by anon/authenticated. Same-origin API routes at `/api/orders/[id]/{pay,ship,receive,review}`.

## Important files

- src/lib/server/database.ts — migration runner, serialized identity/service transactions and local persistence.
- supabase/migrations/ — actual schema and controlled SQL; supabase/seed.sql is fictional.
- src/lib/server/marketplace.ts — allowlisted DTO mapping; repository.ts chooses local or Supabase RPCs.
- src/lib/auction/ — pure reference implementation with unit tests; real bids execute SQL.
- src/components/pages/auction-live.tsx and bid-controls.tsx — live display and bidding interactions. Bid controls render only while LIVE.
- src/components/pages/listing-writer.tsx, seller-apply-form.tsx, admin-desk.tsx, /sell, /selling, /selling/[id] and /admin — seller onboarding, draft writer and audited moderation desk.
- src/components/pages/order-actions.tsx and /orders/[id] — local mock checkout, ship, receipt and review actions.
- tests/database/security-regressions.test.ts, sql-engine.test.ts and order-mutations.test.ts — real SQL behavior/permissions under PGlite.
- tests/services/ — request, auth, DTO and scheduler regressions.
- src/lib/server/local-closer.ts and src/instrumentation.ts — opt-in local closer; calls `localServiceRpc("settle_due")`, not `headers()`.
- tests/e2e/marketplace.spec.ts — local browser flow, responsive regressions, and Hasselblad mock pay→ship→receive→review.
- playwright.config.ts — builds and starts an isolated server at localhost:3100 with a fresh .local/e2e-* database, generated in-memory test secret, CRON_SECRET, and `AUCTA_LOCAL_CLOSER` blanked.

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
2. Real PostgreSQL multi-connection concurrency tests when a local PostgreSQL/Docker runtime is available. PGlite queues requests and cannot prove row-lock contention. Hosted durable closing remains unverified.
3. M6 polish (accessibility, SEO, gallery, empty/loading). Reports/disputes/suspension remain later trust-safety work. Real payment providers stay deferred under the local-only decision.
4. Only revisit cloud setup when the user changes the local-only decision.

## Verification results

- Unit/service/database tests: **229 passed across 12 files** (14 September). Includes seller apply/draft/submit, listing/seller moderate SQL, order pay/ship/receive/review, local closer gates, order API contracts, and negative permissions under PGlite.
- Typecheck: passed on 14 September.
- Lint: full project passed on 14 September with no warnings.
- Production build: passed on 14 September, including `/api/orders/[id]/pay|ship|receive|review` and instrumentation.
- Browser verification: **9 passed** (1.9m with `AUCTA_E2E_SKIP_BUILD=true` after a successful production build). Includes Hasselblad close → Nadia mock pay at 320px → Raka ship → Nadia receive/review. Catalogue, auth, bidding, seller draft, and admin approve still pass.
- Hosted Supabase Auth/Realtime/Storage, durable hosted closing, real multi-connection PostgreSQL concurrency, and live payment providers remain unverified. Reports/disputes/suspension have no mutation endpoints. Mock checkout does not collect money.
