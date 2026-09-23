# AUCTA product contract

Updated 24 September 2026. The user selected `refactor-product-ux-and-motion.zip` as the application version and requested dedicated Supabase and Vercel connections. This supersedes earlier local-only implementation notes. Unrelated Project Arena resources remain out of scope.

AUCTA is an auction-first Indonesian collectible marketplace: rare things, real prices. English first, with Bahasa Indonesia UI support, integer IDR only. Watches, cameras, cards, sneakers, gaming, vintage electronics, design and art are in scope. Regulated categories, wallets, crypto, AI valuation and social feeds are excluded. Do not describe AUCTA as escrow.

## Adopted implementation

The selected version uses Next.js App Router, React, Tailwind, Drizzle and PostgreSQL. Supabase hosts the database; the application has its own email OTP/magic-link and optional Google authentication, signed sessions and user records. It does not use Supabase Auth. The old PGlite/RPC application and its test results do not describe this version.

Catalogue, auction detail, seller desk, checkout, account, notifications and admin screens exist. Server transaction code handles proxy bids, closing and order creation. These surfaces do not establish launch readiness or prove all authorization and payment transitions safe.

Production demo seeding, the development inbox and manual payment simulation must remain disabled. The production catalogue starts empty; sample inventory must never appear as genuine merchandise. SMTP delivery and real payment acceptance require configured providers and independent verification.

## Target experience and authority

Discover → watch → bid → compete → win → pay → receive → review. Warm paper, near-black ink and editorial typography. Mobile controls must work at 320px, with keyboard access and reduced-motion support. Winners, reserves, permissions, payment transitions and settlement are server/database authoritative. Never serialize private reserves or competing maximums to client components.

## Acceptance sequence

1. Establish dedicated deployment/database connectivity and restricted credentials.
2. Verify authentication, participant/admin permissions and public/private response boundaries.
3. Prove auction math, concurrency, anti-sniping, idempotency and one-order settlement on real PostgreSQL.
4. Verify seller onboarding, draft submission, moderation and image handling.
5. Verify real payment signatures, retries, refunds, payouts, shipping and reviews.
6. Configure durable closing, monitoring, backup/restore and operational ownership.
7. Complete browser, accessibility, typecheck, lint, test and production-build acceptance.

See HANDOFF.md and ROADMAP.md for open gates. Connection or deployment success is not marketplace completion.
