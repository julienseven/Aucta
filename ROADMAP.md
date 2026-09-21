# AUCTA roadmap

See HANDOFF.md for the exact current implementation, audit fixes, verified checks and next tasks. Keep infrastructure local by user instruction.

| Milestone | State |
| --- | --- |
| M0 — Contract freeze | Defined in PRODUCT.md, ARCHITECTURE.md, DATABASE.md and AUCTION_ENGINE.md. |
| M1 — Foundation | Working local foundation; hosted Supabase Auth is deferred and unverified. |
| M2 — Auction core | SQL/reference rules, local sessions, watchlists and scoped polling implemented. Opt-in process-local closer exists. Durable hosted scheduler and true multi-connection PostgreSQL concurrency remain acceptance gates. |
| M3 — Seller flow | Implemented locally. Onboarding, drafts, autosave and submit exist; lots remain PENDING_REVIEW until an admin decision. |
| M4 — Moderation | Listing/seller decisions, report review, dispute pause/resume and non-admin suspension/restoration implemented locally with audited SQL decisions. |
| M5 — Transaction loop | Implemented locally. Idempotent SQL settlement plus mock pay, manual ship, receipt and review mutations. Disputes resume their exact previous state. Payouts stay pending; real providers and refunds are not connected. |
| M6 — Polish | Partial: editorial responsive UI, catalogue, auction detail and sold archive. |
| M7 — Launch audit | Local regression coverage exists; production acceptance and a live payment provider are incomplete. |

Next acceptance work is real PostgreSQL multi-connection verification when a local runtime is available, plus independent accessibility review. Hosted scheduler and cloud/provider integration remain separate gates under the local-only decision. Seeded completed orders do not replace the SQL and browser mutation tests.
