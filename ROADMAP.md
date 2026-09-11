# AUCTA roadmap

See HANDOFF.md for the exact current implementation, audit fixes, verified checks and next tasks. Keep infrastructure local by user instruction.

| Milestone | State |
| --- | --- |
| M0 — Contract freeze | Defined in PRODUCT.md, ARCHITECTURE.md, DATABASE.md and AUCTION_ENGINE.md. |
| M1 — Foundation | Working local foundation; hosted Supabase Auth is deferred and unverified. |
| M2 — Auction core | SQL/reference rules, local sessions, watchlists and scoped polling implemented. Durable scheduler and true multi-connection PostgreSQL concurrency remain acceptance gates. |
| M3 — Seller flow | Implemented locally. Onboarding, drafts, autosave and submit exist; lots remain PENDING_REVIEW until an admin decision. |
| M4 — Moderation | Listing and seller approve/reject implemented locally with audited SQL RPCs. Reports, disputes and suspension are still read-only. |
| M5 — Transaction loop | Idempotent SQL settlement/order creation exists. Checkout, payment persistence, shipping, receipt and review mutations are not connected. |
| M6 — Polish | Partial: editorial responsive UI, catalogue, auction detail and sold archive. |
| M7 — Launch audit | Local regression coverage exists; production acceptance and full marketplace loop are incomplete. |

The next feature milestone is M5 transactions. M2 closer/concurrency remains an acceptance gate. Seeded completed orders do not demonstrate a working buyer-to-seller transaction loop.
