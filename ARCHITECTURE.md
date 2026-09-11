# Architecture contract

## Structure

```text
src/app/                    Next.js App Router pages, API handlers, metadata
src/components/             Reusable accessible marketplace interface
src/lib/domain.ts           Public DTOs (no reserve or competitors' ceilings)
src/lib/auction/             Pure reference auction rules, money, tests
src/lib/server/              Server-only repository, sessions, authorization
src/lib/supabase/            Browser/server clients and session refresh
src/lib/payments/            Provider contract and isolated mock provider
src/lib/shipping/            Manual shipment provider contract
src/lib/config.ts           Fees, currency, timing and locale policies
supabase/migrations/        Schema, RLS, controlled transactional RPCs
supabase/seed.sql            Clearly fictional development inventory
tests/                      Database, concurrency and browser verification
public/                     Original development object illustrations
```

## Authority

Next.js server components render public catalogue and user-scoped views. Mutations authenticate on the server, validate input, and call database functions. PostgreSQL row locks serialize each auction. Public auction snapshots omit reserve, raw bidder identity and private maximums. Subscriptions only observe an individual auction's sanitized state; the server timestamp synchronizes display timers using a monotonic browser clock.

Supabase Auth uses email OTP/magic link and optional Google OAuth with PKCE, same-origin redirects, verified server identity and cookie refresh. Authorization comes from protected database records, never user-editable metadata. Seller verification and admin roles are separate from public profiles.

## Development and production

Production uses Supabase PostgreSQL/Auth/Storage/Realtime on Vercel. Local development can use embedded PostgreSQL (PGlite) and explicit seeded development identities to run the same schema/RPC rules when cloud credentials are absent. Local authentication is a test facility, never a production fallback. The application must fail closed for protected operations when production configuration is missing. Local state is persisted outside tracked files; no client localStorage authority for money or permissions.

## External providers

Payment interface: `createPayment`, `getPaymentStatus`, `handleWebhook`, `refundPayment`, `createSellerPayout`, `getPayoutStatus`. Provider-neutral order/payment/payout records use integer IDR, stable idempotency keys and immutable amount snapshots. `PAYMENT_PROVIDER=mock` is explicit and isolated. Webhook verification occurs before state mutation. No wallet or escrow claims. Production provider onboarding remains an external integration.

Shipping records carrier/tracking manually; no invented carrier verification. Notifications are deduplicated in-app records with an email outbox/adapter seam. Cron invokes an authenticated server closing endpoint; PostgreSQL rechecks eligibility and settles idempotently. Database scheduling is preferred where the hosting plan cannot supply a sufficient closing cadence.

## Quality gates

Typecheck, ESLint, automated tests and production build. Database permission and concurrent bidding tests exercise the actual SQL operations. Browser tests cover the seller-to-review loop in explicit local mode. Cloud auth, Realtime, storage, scheduler and payment provider acceptance are separate launch gates.
