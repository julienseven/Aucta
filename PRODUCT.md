# AUCTA product contract

Rare things. Real prices. An auction-first Indonesian collectible marketplace, English first, IDR only. Watches, cameras, cards, sneakers, gaming, vintage electronics, design and art are in scope. Regulated categories, wallets, crypto, AI valuation and social feeds are excluded.

## Current state — 14 September 2026

A working Next.js application now provides the local foundation and auction-core slice. The user chose to keep infrastructure local: development uses PGlite and explicitly labeled, signed local identities restricted to loopback requests. Hosted Supabase authentication, a dedicated cloud project and deployment are deferred and unverified. Unrelated Project Arena infrastructure must not be repurposed.

Implemented behavior includes catalogue search/filtering, auction detail, database-authoritative proxy bidding, reserve and anti-snipe rules, settlement/order creation, idempotent watchlists, scoped bid polling, and account views. A signed-in collector can apply for a seller desk; a seller can draft a listing, autosave it, and submit it for review. An administrator can approve or reject pending listings and seller applications with a recorded reason. Approved lots enter `SCHEDULED` or `LIVE` and then appear in the catalogue; rejected lots stay out of the catalogue and can be edited and resubmitted. After settlement, the winning buyer can record a mock payment, the seller can enter carrier/tracking, the buyer can confirm receipt and publish a review. SQL is the order of record; no money is collected. Reports, disputes and account suspension have no decision endpoints yet. Fictional inventory and a seeded completed order are development fixtures.

An opt-in process-local closer exists; a durable hosted scheduler and multi-connection PostgreSQL concurrency verification remain auction-core acceptance gates. Real payment providers, webhooks, refunds and payouts remain to be built. See HANDOFF.md and ROADMAP.md for the detailed status and verification record.

## Target experience

Discover → watch → bid → compete → win → pay → receive → review. Cream paper, near-black ink and oxblood; editorial serif headings with precise sans-serif controls. Auctions are events, with large object imagery and clear prices, time, provenance and condition. Mobile controls remain usable at 320px. All sample inventory is identified as fictional development data.

## Routes

`/`, `/auctions`, `/auction/[slug]`, `/sold`, `/sell`, `/watchlist`, `/account`, `/selling`, `/selling/[id]`, `/orders/[id]`, `/admin`, `/sign-in`, auth callbacks and the six policy pages in the brief.

## Acceptance sequence

This sequence defines the full marketplace acceptance target; it is not a list of completed features.

0. Freeze this contract, architecture, schema and auction rules.
1. Install pinned stable Next.js/React/TypeScript/Tailwind, establish Supabase SSR auth, migrations, seed inventory and navigation.
2. Prove atomic bidding, proxy competition, reserve, extensions, settlement and permissions before advancing transactional workflows.
3. Seller onboarding, autosaved listings, image upload and review submission.
4. Audited listing/seller moderation, reports and disputes.
5. Idempotent order creation, isolated mock payment, manual shipping, receipt and reviews.
6. Responsive, accessible and editorial polish, metadata and sold archive.
7. Typecheck, lint, unit/integration/concurrency and browser tests, build, security and deployment audit.

The real cloud two-user flow and deployment cannot be declared verified without dedicated infrastructure and credentials. Local development authentication must be visibly labeled and impossible to enable on a deployed production host.
