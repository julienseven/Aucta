# AUCTA auction engine contract

This is the target acceptance contract. The adopted Drizzle application is assessed against it; targets below must not be read as verification claims.

## States and money

Target lifecycle: DRAFT → PENDING_REVIEW → SCHEDULED → LIVE → ENDED → AWAITING_PAYMENT → PAID → FULFILLMENT → COMPLETED. Current source uses its own lowercase lot/order states and must preserve the equivalent transition rules. Closing without a bid or reserve produces no sale. Payment timeout cancels an unpaid order. Moderation, cancellation, dispute and refund transitions require authorized actors and audit evidence.

Whole integer IDR only. Increments: below 1m: 25,000; 1m–4,999,999: 50,000; 5m–19,999,999: 100,000; 20m+: 250,000. An auction may override the increment. Seller fee defaults to 700 basis points, buyer fee zero; fee arithmetic and order snapshots must remain consistent.

## Atomic bidding

1. Authenticate and reject suspended/unverified bidders and the seller.
2. Lock the lot row; read database time after locking.
3. Require live, started and before its end. Validate bounded positive integer maximums and acceptable minimums.
4. Keep one ceiling per bidder. Each update receives new chronological priority. Requests carry persistent caller-scoped idempotency keys.
5. Rank maximum descending, chronological priority ascending. With one bidder, start at opening price. With competition, use min(top ceiling, second ceiling + increment(second ceiling)), bounded below by opening/current price. Reserve floors may raise price toward reserve but never beyond the top ceiling.
6. Equal ceilings favor the earliest equivalent ceiling. Never publish private submitted ceilings as public activity.
7. Persist visible price, leader, counters, audit and deduplicated notifications atomically. Return only a public snapshot and caller-owned information.

## Anti-sniping and closing

A competitive bid in the last 120 seconds adds 120 seconds to the existing end. Raising an already-leading ceiling alone does not extend the clock. Clients display synchronized time but do not decide eligibility.

A durable scheduler finds due lots. Closing locks the same lot row and rechecks the current deadline/state before creating at most one order or recording no sale. Workloads are bounded and retryable. Closing does not depend on an open browser.

Payment expiry and settlement share an order lock. Expiry may revert a lot only after confirming the order is still unpaid and its deadline has passed. Provider signatures, amounts and event identity must be verified before settlement.

## Privacy and acceptance

No self-service withdrawal in V1. Admin cancellation requires reason/audit. Public bidder aliases should be auction-scoped. Never serialize reserves, competing ceilings, auth user IDs, emails or full addresses to catalogue clients.

Applied code repairs include private reserve removal from BidPanel props, reserve floors, safe-integer validation, chronological ceiling ordering and locked deadline/status rechecks. Database-time authority, durable idempotency/outbox, scoped aliases and full transition/permission review remain acceptance gaps.

Required real PostgreSQL tests: 10 and 50 competing bids, 100 near-close requests, equivalent maxima, leading raises, reserve crossings, extension boundaries, late rejection, one winner/order, price monotonicity and response privacy. Mocked boundary tests do not demonstrate PostgreSQL lock contention. Document actual results separately from these requirements.
