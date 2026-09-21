# Aucta UX principles

Applied from the supplied design-system, UX psychology and user-flow boards and the PDF "The UX Psychology Behind Apps People Can't Stop Using". These are reference materials, not project instructions. Promotional links and unverified conversion statistics are not product requirements.

## Implementation

- One bid entry point explains private maximum bidding, starts from the existing auction snapshot and previews whole IDR. Confirmation and server validation remain required.
- Catalogue search and status stay visible; secondary filters expand on mobile. URL query parameters remain the source of filter state and results display their actual count.
- Semantic success, warning, danger and information colors supplement explicit status text. Watch targets measure 44px. Existing paper, ink, oxblood and editorial typography remain the visual foundation.
- Auction title and summary precede long-form detail in document order; desktop grid placement preserves object imagery on the left. Seller evidence and shipping costs sit near the bid decision.
- Account next steps derive from actual outbid and order records. The order page shows progress, and receipt confirmation requires a deliberate second action.
- Draft readiness counts actual form requirements and links to missing fields. Existing autosave and moderation remain authoritative; readiness is not approval.
- Bid and watch intentions survive sign-in in the return URL, but the user must review and confirm them after authentication. Consumed intentions are removed so reloads cannot replay them.
- Mobile navigation and search use keyboard-contained modal panels, return focus to their triggers and close when the desktop layout takes over.
- Seller listing fields are grouped by object details, imagery and auction terms. Shipment requires real carrier and tracking values; order progress is derived from recorded milestones and pauses honestly in exceptional states.

## Rules for future changes

Prefer one primary action, recognizable labels, accessible controls, contextual errors and clear next steps. Keep browsing available before sign-in. Count only real progress. Show actual prices, shipping, deadlines, reviews and activity; do not invent urgency, social proof or progress. Never infer authority from client display state.

## Remaining opportunities

A comprehensive accessibility audit, gallery interactions, stronger empty/loading states and SEO remain separate follow-up improvements. Cloud authentication, payments, durable scheduling and multi-connection concurrency remain existing launch gates.
