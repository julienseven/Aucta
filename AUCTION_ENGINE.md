# Auction engine contract

## States

`DRAFT → PENDING_REVIEW → SCHEDULED → LIVE → ENDED → AWAITING_PAYMENT → PAID → FULFILLMENT → COMPLETED`.

Moderation may reject drafts/review submissions; admins may cancel with a reason and audit. Closing without bids or below reserve produces `NO_SALE`. Payment timeout produces `PAYMENT_FAILED`. Eligible orders can enter `DISPUTED` and a controlled resolution can produce `REFUNDED` or resume fulfillment. There is no arbitrary frontend status update API. ENDED is an internal settlement transition committed together with its final outcome.

## Money and increments

Whole IDR integers only. Defaults: below 1m: 25,000; 1m–4,999,999: 50,000; 5m–19,999,999: 100,000; 20m+: 250,000. An auction may override its increment. The applicable increment is evaluated at the reference price. Seller fee is 700 basis points; buyer fee 0. Fee rounding is centralized integer arithmetic and snapshotted into orders.

## Atomic bid processing

1. Authenticate and reject suspended/unverified-email bidders or the seller.
2. Lock the auction row `FOR UPDATE`; read database time after acquiring the lock.
3. Require LIVE, started, and `now < ends_at`. Validate a bounded positive integer maximum and the minimum acceptable bid. A leading bidder can only raise their existing private ceiling.
4. Store one maximum per bidder. Each ceiling update gets a new chronological priority, so raising to an equal ceiling cannot steal an earlier equal bid. Requests carry an idempotency key.
5. Rank ceilings descending, priority ascending. The first-ranked bidder leads. With one bidder, price starts at the opening price; with competition it is `min(top_max, second_max + increment(second_max))`, bounded below by the starting/current price. If the winner can meet a hidden reserve, price is at least that reserve but never above their ceiling.
6. Equal ceilings go to the earliest equivalent maximum. Public activity records visible competitive prices, not submitted private ceilings. Retries cannot add duplicate bids.
7. Persist current price/leader, counters, risk flags and deduplicated notifications in the same transaction. Return only public snapshot and the caller's own leading/max information.

## Anti-sniping

A qualifying competitive bid accepted with `ends_at - now <= 120 seconds` adds 120 seconds to the existing end. Raising an already-leading private ceiling alone does not extend or manufacture public bidding activity. Repeated qualifying bids can extend repeatedly. Return an extension flag and authoritative server time. Countdown uses `performance.now()` elapsed time since synchronization, never wall-clock authority.

## Closing

A scheduler finds due live auctions and invokes settlement. Settlement locks the same auction row, rechecks database time/state, and either records NO_SALE or generates one order using unique auction ID and price/fee snapshots. Repeated settlement returns the same result. Closing is independent of any open browser. A batch uses a bounded workload and can be safely retried.

## Withdrawal and privacy

No self-service bid withdrawal in V1. A controlled admin cancellation requires a reason and audit; cancellation must not silently rerank an ongoing auction. Public bidders have auction-scoped aliases. Never serialize proxy records, reserves, auth user IDs, emails or full addresses to catalogue clients.

## Required verification

Increment boundaries, equal maxima, leading increases, reserve crossings, rejected bids, extension boundaries, safe fee arithmetic and illegal states. Run actual SQL tests with 10 and 50 competing bids plus 100 near-closing requests; assert one winner/order, monotonic valid price, no late acceptance and no private-field leakage. Report actual results separately from planned cloud acceptance.
