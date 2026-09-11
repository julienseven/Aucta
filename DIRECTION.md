# AUCTA — Build the Auction Marketplace

You are the lead engineering and product agent responsible for taking **AUCTA** from an empty repository to a polished, production-oriented MVP.

Do not build a generic ecommerce template.

AUCTA is an **auction-first marketplace for rare, collectible, desirable, and scarce goods**, initially focused on Indonesia.

The product should feel like:

- eBay's auction mechanics
- StockX-style trust
- Sotheby's presentation quality
- modern realtime product infrastructure
- a premium consumer startup rather than a traditional auction house

The long-term vision is:

> **AUCTA becomes the marketplace where rare things find their real market price.**

Initial categories may include:

- Watches
- Cameras
- Trading cards / TCG
- Sneakers
- Gaming collectibles
- Vintage electronics
- Designer objects
- Art and collectibles

Do not implement cars, property, regulated financial products, weapons, alcohol, or other highly regulated categories in V1.

---

# 1. PRODUCT PRINCIPLES

AUCTA should make auctions feel like events.

Users shouldn't merely browse listings.

They should:

```text
DISCOVER
   ↓
WATCH
   ↓
BID
   ↓
COMPETE
   ↓
WIN
   ↓
PAY
   ↓
RECEIVE
   ↓
REVIEW
   ↓
SELL / BID AGAIN
```

The core psychological experience should combine:

- discovery
- scarcity
- competition
- trust
- anticipation
- price discovery

The website should feel alive without becoming visually noisy.

---

# 2. BRAND

Name:

# AUCTA

Working positioning:

> Rare things. Real prices.

Alternative copy where appropriate:

> The market decides.

> Objects worth competing for.

> Find it. Bid for it. Own it.

Do not overuse slogans.

## Visual character

AUCTA should feel:

- premium
- contemporary
- editorial
- collectible
- sophisticated
- minimal
- highly intentional

Avoid:

- typical purple SaaS gradients
- generic ecommerce templates
- excessive rounded cards
- cartoonish iconography
- crypto aesthetics
- excessive glassmorphism
- giant gradients everywhere
- crowded dashboards
- cheap marketplace aesthetics

Think:

```text
Sotheby's
+
Aesop
+
Apple
+
modern fashion editorial
+
high-end auction catalogue
```

but make it distinctly AUCTA.

## Suggested palette

Use a restrained neutral palette:

```text
Background:
#F3F0E9

Primary dark:
#10100F

Secondary:
#262521

Muted:
#8A877E

Border:
#D7D2C8

White:
#FAF9F6

Accent:
deep oxblood / auction red
approximately #761D18
```

Refine these if necessary for accessibility and cohesion.

Typography should carry much of the visual identity.

Use a premium serif/editorial face for major display headings where appropriate and a clean sans-serif for utility/interface text.

Do not sacrifice usability for typography.

---

# 3. TARGET USER TYPES

Support these primary personas.

## Buyer

Can:

- browse auctions
- search
- filter
- follow categories
- watch listings
- place bids
- configure maximum/proxy bids
- receive outbid notifications
- win auctions
- pay
- track delivery
- open disputes
- leave reviews
- view bidding history

## Seller

Can:

- create seller profile
- create listing
- upload images
- select category
- specify item condition
- add provenance/details
- set starting price
- set reserve price
- configure minimum increment
- choose auction duration
- submit listing for review
- monitor bidding
- fulfill won auctions
- see sale history

## Admin / Moderator

Can:

- approve sellers
- moderate auctions
- approve/reject listings
- suspend listings
- cancel auctions under controlled conditions
- handle disputes
- view suspicious activity
- inspect bidding history
- manage categories
- feature auctions
- view basic marketplace metrics

---

# 4. TECH STACK

Default stack:

```text
Next.js
TypeScript
React
Tailwind CSS
Supabase
PostgreSQL
Supabase Auth
Supabase Storage
Supabase Realtime
Vercel
```

Use current stable versions compatible with each other.

Architecture should be production-oriented.

Use server-side authorization wherever required.

Never trust the browser for:

- winning bid calculations
- payment state
- seller permissions
- auction settlement
- reserve-price evaluation
- auction closing
- privileged admin operations

---

# 5. PAYMENT ARCHITECTURE

Do not create an internal AUCTA wallet.

Do not treat buyer balances as stored monetary value.

Create a clean payment-provider abstraction that can later support an Indonesian licensed payment provider.

The interface should support:

```text
createPayment()
getPaymentStatus()
handleWebhook()
refundPayment()
createSellerPayout()
getPayoutStatus()
```

Do not fake production escrow semantics.

For development, implement:

```text
PAYMENT_PROVIDER=mock
```

with clearly isolated mock payment functionality.

Make provider implementation swappable.

Potential production payment capabilities AUCTA will eventually require:

- QRIS
- virtual accounts
- cards
- Indonesian e-wallets
- payment confirmation
- seller disbursement/payout
- refunds
- webhook verification

Do not hardcode Stripe assumptions into the database domain model.

---

# 6. CORE DATABASE DOMAIN

Design the actual schema before implementing UI.

Expected major entities:

```text
profiles
seller_profiles
addresses

categories
brands

listings
listing_images
listing_attributes

auctions
bids
proxy_bids
watchlists

orders
payments
payouts

shipments

reviews
disputes

notifications

admin_actions
audit_logs

reports
```

Use database enums carefully.

Maintain timestamps consistently.

Prefer UUIDs.

Add appropriate indexes.

Add foreign keys.

Use soft-deletion where appropriate.

Do not store monetary amounts as floating-point numbers.

Use integer smallest-unit representation where reasonable.

For Indonesian Rupiah, storing whole IDR integer values is acceptable.

---

# 7. AUCTION STATE MACHINE

Auction lifecycle must be explicit.

Example:

```text
DRAFT
↓
PENDING_REVIEW
↓
SCHEDULED
↓
LIVE
↓
ENDED
↓
AWAITING_PAYMENT
↓
PAID
↓
FULFILLMENT
↓
COMPLETED
```

Additional states:

```text
REJECTED
CANCELLED
NO_SALE
PAYMENT_FAILED
DISPUTED
REFUNDED
```

Transitions must be controlled.

Do not allow arbitrary frontend mutation of auction status.

---

# 8. REALTIME BIDDING ENGINE

This is the most important engineering component.

Treat it as a transactional system.

## Requirements

A bid must be processed atomically.

The server/database must validate:

- auction exists
- auction is live
- auction has not expired
- bidder is authenticated
- bidder is not the seller
- bidder is allowed to participate
- amount satisfies bid requirements
- bid does not violate auction rules

Two simultaneous bids must not create two winners.

Use PostgreSQL transactions / database locking / RPC / server-side atomic operations as appropriate.

Never implement winning-bid computation exclusively in React.

---

# 9. MINIMUM BID INCREMENTS

Implement configurable increments.

Example initial rules:

```text
Rp0 – Rp999,999
increment: Rp25,000

Rp1,000,000 – Rp4,999,999
increment: Rp50,000

Rp5,000,000 – Rp19,999,999
increment: Rp100,000

Rp20,000,000+
increment: Rp250,000
```

Architecture should allow these values to change.

---

# 10. PROXY BIDDING

Implement eBay-style maximum bidding.

Example:

```text
Current price:
Rp1,000,000

Buyer A maximum:
Rp2,000,000

Buyer B bids:
Rp1,300,000
```

AUCTA automatically increases Buyer A's displayed winning bid only enough to remain ahead:

```text
Rp1,350,000
```

depending on the applicable increment.

The maximum bid should remain private.

Users should never see competitors' proxy ceilings.

Handle:

- equal maximum bids
- simultaneous bids
- minimum increment boundaries
- reserve price
- auction extension
- bidder withdrawal policy

Chronologically earlier equivalent maximum bid should have priority unless product rules specify otherwise.

Write extensive automated tests for proxy bidding.

---

# 11. ANTI-SNIPING

Auctions should not reward network latency.

Default rule:

```text
Any qualifying bid placed within
the final 2 minutes

→ auction extends by 2 minutes.
```

Repeated late bids can continue extending the auction.

The frontend timer must reconcile with authoritative server time.

Never trust the user's system clock.

Show clear feedback:

```text
AUCTION EXTENDED
New bid received
+2 minutes
```

---

# 12. RESERVE PRICE

Seller may optionally define:

```text
starting_price
reserve_price
```

Reserve price is hidden.

UI may display:

```text
Reserve not met
```

or

```text
Reserve met
```

but never reveal the hidden reserve amount.

When auction ends below reserve:

```text
NO_SALE
```

No buyer payment should be generated.

---

# 13. BUY NOW

Do not prioritize this ahead of auction functionality.

Architecture may support:

```text
buy_now_price
```

but initial launch can leave it disabled.

Auctions are AUCTA's differentiator.

---

# 14. HOMEPAGE

Create a highly polished homepage.

Suggested structure:

## Navigation

```text
AUCTA
Auctions
Categories
Sell
Search

Watchlist
Account
```

Logged-out:

```text
Sign In
Join AUCTA
```

Do not show authentication CTAs incorrectly after login.

---

## Hero

Avoid generic SaaS hero copy.

Something closer to:

```text
RARE THINGS.
REAL PRICES.

Curated objects.
Open bidding.
The market decides.
```

Feature one striking auction item.

Show:

```text
CURRENT BID

Rp 18.750.000

12 bidders
43 watching

01:42:17
```

CTA:

```text
VIEW AUCTION
```

---

## Live Now

Large editorial auction cards.

Show:

- item photography
- title
- current bid
- bidder count
- remaining time
- verified status

---

## Ending Soon

Horizontally scrollable or grid-based.

Keep performant.

---

## Featured Categories

Examples:

```text
WATCHES
CAMERAS
CARDS
SNEAKERS
DESIGN
GAMING
```

---

## Recently Sold

This section is important because it demonstrates price discovery.

Example:

```text
Rolex Explorer 124270

SOLD
Rp 108.500.000

24 bids
```

---

## Trust

Explain:

```text
Verified sellers
Transparent bidding
Buyer protection
Condition standards
Secure payments
```

Keep this concise.

---

# 15. AUCTIONS DISCOVERY PAGE

Route:

```text
/auctions
```

Support:

- live
- upcoming
- ending soon
- recently sold

Filters:

- category
- price range
- condition
- verified sellers
- ending time
- brand

Sorting:

- ending soon
- newest
- most watched
- most bids
- price ascending
- price descending

Search should work reliably.

Use URL query parameters so views are shareable.

---

# 16. AUCTION DETAIL PAGE

This is AUCTA's most important page visually.

Route:

```text
/auction/[slug]
```

Layout should include:

## Gallery

High-resolution item imagery.

Desktop:
large editorial gallery.

Mobile:
swipeable.

Support image zoom.

---

## Auction information

Show:

```text
Brand

Item name

Condition

Current bid

Bid count

Watch count

Time remaining
```

Prominent:

```text
PLACE BID
```

and:

```text
SET MAX BID
```

---

## Auction timer

Must feel live.

Use synchronized server timing.

Display appropriate urgency without cheap flashing effects.

---

## Bid activity

Example:

```text
Bidder 8***2       Rp 9,350,000
Bidder 2***8       Rp 9,250,000
Bidder 8***2       Rp 9,100,000
```

Protect user privacy.

Do not expose email, real name or sensitive information.

---

## Item Details

Include:

- description
- condition
- flaws
- dimensions
- model
- year
- serial number policy
- included accessories
- provenance if relevant

---

## Seller

Show:

```text
Seller name
Verified badge
Joined date
Review score
Completed sales
Location at city/province granularity
```

Do not display private address.

---

## Shipping + protection

Clearly explain:

- shipping responsibility
- estimated process
- buyer protection
- dispute window

---

# 17. CREATE LISTING FLOW

Route:

```text
/sell
```

Make the workflow excellent.

Suggested steps:

```text
1. Category
2. Item
3. Photos
4. Condition
5. Auction
6. Shipping
7. Review
```

Autosave drafts.

## Photos

Require:

- cover image
- multiple detail images

Recommend:

- front
- back
- sides
- serial/model
- defects
- accessories

Support reorder.

Compress safely without destroying quality.

---

## Condition

Create category-appropriate condition standards.

Initial generic options:

```text
New
Like New
Excellent
Good
Fair
For Parts
```

Include seller notes.

---

## Auction

Seller defines:

```text
starting price
optional reserve
auction duration
scheduled start
```

Show fee preview.

---

# 18. WATCHLIST

Route:

```text
/watchlist
```

Users can watch auctions.

Show:

- ending soon
- current price
- whether user is leading
- whether user was outbid
- auction status

Use notifications intelligently.

---

# 19. ACCOUNT AREA

Route:

```text
/account
```

Sections:

```text
Overview
Bidding
Won
Purchases
Watchlist
Selling
Sales
Reviews
Settings
```

The UI should remain consumer-oriented rather than looking like enterprise SaaS.

---

# 20. SELLER DASHBOARD

Route:

```text
/selling
```

Seller sees:

```text
Active auctions
Draft listings
Pending review
Sold
Awaiting shipment
Completed
```

Basic metrics:

```text
Gross sales
Completed auctions
Sell-through rate
Average bids
Watchers
```

Do not overbuild analytics in V1.

---

# 21. CHECKOUT

Winner should receive:

```text
CONGRATULATIONS
YOU WON
```

Then proceed to checkout.

Order page should contain:

```text
Item
Winning bid
Marketplace fee if applicable
Shipping
Total
Delivery address
Payment
```

Payment expires according to configurable policy.

Example:

```text
Payment required within 24 hours.
```

Do not immediately implement punitive bidder mechanisms, but create architecture for future unpaid-winner handling.

---

# 22. SELLER FULFILLMENT

After payment:

```text
Seller notified
↓
Seller ships
↓
Tracking entered
↓
Buyer receives
↓
Completion
↓
Seller payout
```

Implement an abstract shipping layer.

Initial development mode can allow manual:

```text
carrier
tracking_number
```

Do not pretend automatic carrier verification exists unless implemented.

---

# 23. REVIEWS

Reviews should be transactional.

Only participants in a completed transaction may review each other.

Buyer → Seller is highest priority.

Store:

```text
rating
text
transaction_id
created_at
```

Prevent duplicate reviews.

---

# 24. DISPUTES

Basic dispute system.

Reasons:

```text
Item not received
Item not as described
Suspected counterfeit
Damaged item
Wrong item
Other
```

Store evidence.

Admin can:

```text
open
review
request evidence
resolve buyer
resolve seller
refund
close
```

Every admin decision should produce an audit log.

---

# 25. TRUST & SAFETY

Create a basic trust architecture from day one.

Support:

```text
email verification
seller verification status
report listing
report seller
listing moderation
bid monitoring
account suspension
admin logs
```

Do not invent fake KYC.

Instead model:

```text
verification_status:
unverified
pending
verified
rejected
```

Production KYC provider can be integrated later.

---

# 26. ANTI-FRAUD

At minimum detect or flag:

- seller bidding on own auction
- related account patterns where detectable
- suspicious bid velocity
- repeated unpaid wins
- abnormal price escalation
- newly created accounts bidding very large amounts
- rapid bid cancellations
- repeated dispute behavior

Do not silently auto-ban based solely on heuristics.

Create:

```text
risk_score
risk_flags
```

for moderation.

---

# 27. NOTIFICATIONS

Create a unified notification system.

Support:

```text
in-app
email
```

Later adapters:

```text
WhatsApp
push notifications
```

Events:

```text
auction starting
auction ending soon
new bid
outbid
winning
auction extended
auction won
payment required
payment received
shipment created
delivered
dispute update
listing approved
listing rejected
```

Avoid notification spam.

---

# 28. ADMIN

Route:

```text
/admin
```

Strict admin authorization.

Dashboard should include:

```text
Pending listings
Live auctions
Flagged bids
Reported listings
Disputes
New sellers
GMV
Completed sales
```

Admin actions must be auditable.

---

# 29. AUTHENTICATION

Use Supabase Auth.

Support initially:

```text
email magic link / OTP
Google
```

Make callback handling reliable.

After authentication, navbar state must update correctly.

Do not show:

```text
Sign In
```

to authenticated users.

Do not continue asking authenticated users for email.

Protect authenticated routes.

Implement clean redirect behavior.

Test:

```text
login
logout
expired session
callback
refresh
multiple tabs
```

---

# 30. SECURITY

Implement proper Supabase Row Level Security.

Do not rely on frontend hiding.

Review every table.

Examples:

Users should not be able to:

```text
edit another seller's listing
read private proxy bids
alter winning bids
change payment states
self-approve seller verification
set themselves as admin
modify completed orders
view private addresses
```

Sensitive writes should go through controlled server functions where required.

Audit the application for:

- IDOR
- broken authorization
- insecure server actions
- secret exposure
- SQL/RPC issues
- XSS
- malicious uploads
- rate abuse
- CSRF where applicable

---

# 31. RATE LIMITING

Protect:

```text
bidding
login
listing submission
search
report creation
API mutation endpoints
```

Bid rate limits must not interfere with legitimate auction competition.

---

# 32. ACCESSIBILITY

Meet practical WCAG expectations.

Include:

- keyboard navigation
- visible focus states
- sensible semantic HTML
- readable contrast
- labels
- accessible dialogs
- reduced-motion support
- alt text

---

# 33. MOBILE

Mobile is a first-class interface.

Most Indonesian users may encounter AUCTA through their phone.

The auction page must be excellent on narrow screens.

Consider a sticky bottom bidding control:

```text
Rp 9.350.000
01:42

[ PLACE BID ]
```

Do not cover content.

Test:

```text
320px
375px
390px
430px
tablet
desktop
large desktop
```

---

# 34. MOTION

Use restrained motion.

Good:

- smooth page transitions
- subtle image reveal
- countdown transitions
- bid update animation
- auction extension feedback
- hover treatment
- gallery motion

Bad:

- excessive scroll hijacking
- flashy gradients
- meaningless parallax
- long intro animation
- animation blocking bidding

Performance and clarity win.

---

# 35. PERFORMANCE

Target good Core Web Vitals.

Optimize:

- images
- fonts
- server rendering
- database queries
- bundles
- realtime subscriptions

Avoid sending every bid from every auction to every connected client.

Realtime subscriptions must be scoped.

---

# 36. SEO

Public auction listings should be indexable where appropriate.

Implement:

- metadata
- canonical URLs
- OpenGraph
- structured data where appropriate
- sitemap
- robots
- descriptive slugs

Sold item pages should remain accessible because historical sale prices could eventually become a major AUCTA acquisition channel.

Example:

```text
/auction/leica-m6-black-1992-a84f
```

---

# 37. PRICE ARCHIVE

Create the beginnings of AUCTA's future data moat.

Route:

```text
/sold
```

Show historical completed auctions.

Search/filter historical prices.

Example:

```text
Leica M6
Sold Rp31,400,000

Aug 2026
Condition: Excellent
18 bids
```

Do not build advanced valuation algorithms yet.

Store the data correctly so they can be built later.

---

# 38. MARKETPLACE FEES

Create configurable fee architecture.

Initial development configuration:

```text
seller_fee_percentage = 7%
buyer_fee_percentage = 0%
```

Never scatter fee numbers through components.

Use centralized configuration / fee calculation logic.

Display fees transparently.

---

# 39. INDONESIAN LOCALIZATION

Initial language:

```text
English-first interface
```

but architecture must be internationalization-ready.

Prepare:

```text
en
id
```

Currency:

```text
IDR
```

Display:

```text
Rp 12.500.000
```

not:

```text
IDR 12,500,000.00
```

Handle Indonesia timezone correctly.

Store timestamps in UTC and render appropriately.

---

# 40. COMPLIANCE PLACEHOLDERS

Create proper placeholder pages:

```text
/terms
/privacy
/buyer-protection
/seller-policy
/prohibited-items
/auction-rules
```

Do not fabricate legal guarantees.

Clearly label content requiring legal review.

Add:

```text
LEGAL_REVIEW_REQUIRED
```

comments where appropriate.

The product should be architected to support Indonesian:

- marketplace obligations
- electronic-system requirements
- consumer protection
- personal-data requirements
- auction-related regulatory review
- seller requirements

Do not claim AUCTA is a licensed Balai Lelang unless that legal structure has actually been established.

---

# 41. INITIAL SEED DATA

Seed the development environment with realistic, clearly fictional/sample inventory.

Example categories:

## Watches

- Seiko Prospex
- Omega Speedmaster
- Tudor Black Bay

## Cameras

- Leica M6
- Fujifilm X-Pro3
- Hasselblad 500CM

## Cards

- Pokémon vintage cards
- One Piece TCG
- sports cards

## Sneakers

- New Balance collaborations
- Jordan retros
- Nike SB

## Gaming

- Game Boy Micro
- limited consoles
- retro hardware

Do not scrape copyrighted marketplace photography.

Use legitimate placeholders or generated development imagery.

---

# 42. SAMPLE USER STATES

Seed:

```text
buyer
seller
verified seller
admin
```

Seed auctions in:

```text
upcoming
live
ending soon
sold
reserve not met
```

This allows full UI testing.

---

# 43. TESTING

Testing is mandatory.

Cover auction logic heavily.

At minimum:

## Unit

```text
minimum bid
increments
proxy bidding
reserve
fees
auction time extension
state transitions
```

## Integration

```text
bid placement
simultaneous bids
seller cannot bid
auction expiration
proxy bid competition
payment creation
listing submission
permissions
```

## E2E

```text
sign up
sign in
seller creates listing
admin approves
buyer watches
buyer bids
second buyer outbids
proxy bidding
auction extends
auction ends
winner checks out
seller fulfills
buyer reviews
```

Test unauthorized access explicitly.

---

# 44. CONCURRENCY TESTING

This deserves separate attention.

Simulate multiple users bidding nearly simultaneously.

Test:

```text
10 simultaneous bids
50 simultaneous bids
100 requests around closing time
```

Verify:

- one authoritative order
- no impossible current price
- no duplicate winner
- no stale auction state
- no proxy bid leakage

Document results.

---

# 45. OBSERVABILITY

Implement structured logs for critical events:

```text
bid accepted
bid rejected
auction extended
auction ended
winner determined
payment webhook
refund
admin action
error
```

Avoid logging:

- passwords
- auth tokens
- full payment data
- private proxy maximum bids unnecessarily
- sensitive PII

Prepare error tracking integration points.

---

# 46. REPOSITORY QUALITY

Repository should contain:

```text
README.md
ARCHITECTURE.md
AUCTION_ENGINE.md
DATABASE.md
SECURITY.md
DEPLOYMENT.md
ENVIRONMENT.md
PRODUCT.md
ROADMAP.md
AGENTS.md
```

Do not create useless documentation.

Each should represent the actual implementation.

---

# 47. AGENT EXECUTION MODEL

Operate as a lead agent.

Fan out work when supported.

Recommended agents:

## Agent 1 — Product / UX

Own:

```text
user flows
information architecture
responsive experience
design system
auction UX
```

## Agent 2 — Database / Backend

Own:

```text
schema
RLS
RPC
state machines
server actions
```

## Agent 3 — Auction Engine

Own exclusively:

```text
bidding
proxy bidding
reserve
anti-sniping
concurrency
settlement
tests
```

## Agent 4 — Frontend

Own:

```text
homepage
discovery
auction page
account
seller flows
admin UI
```

## Agent 5 — Auth / Security

Own:

```text
Supabase Auth
authorization
RLS audit
abuse prevention
security review
```

## Agent 6 — QA

Continuously test:

```text
desktop
mobile
auth
bidding
seller flow
edge cases
```

Agents should work on clearly separated branches/worktrees if the environment supports it.

The lead agent reviews and integrates all work.

---

# 48. PHASED EXECUTION

Do not attempt everything simultaneously.

## MILESTONE 0 — Contract Freeze

Before building:

1. Inspect repository.
2. Inspect existing infrastructure.
3. Determine framework versions.
4. Define database architecture.
5. Define auction rules.
6. Define payment abstraction.
7. Define auth architecture.
8. Produce implementation plan.
9. Identify external blockers.
10. Do not redesign product direction.

Deliver:

```text
PRODUCT.md
ARCHITECTURE.md
AUCTION_ENGINE.md
DATABASE.md
```

---

## MILESTONE 1 — Foundation

Build:

```text
Next.js app
design system
Supabase connection
database migrations
RLS
auth
profiles
navigation
seed data
```

Exit criteria:

User can authenticate and browse seeded auctions.

---

## MILESTONE 2 — Auction Core

Build:

```text
listing
auction state
bidding
increments
proxy bidding
reserve
anti-sniping
realtime
watchlist
```

Exit criteria:

Two real authenticated users can safely compete in the same auction.

Do not proceed unless automated tests pass.

---

## MILESTONE 3 — Seller Flow

Build:

```text
seller onboarding
create listing
images
draft
auction configuration
review submission
seller dashboard
```

Exit criteria:

Seller can submit a complete auction to moderation.

---

## MILESTONE 4 — Moderation

Build:

```text
admin
listing review
seller controls
reports
flags
audit logs
```

Exit criteria:

Admin can safely approve an auction into scheduled/live inventory.

---

## MILESTONE 5 — Winner / Transaction

Build:

```text
auction settlement
order generation
mock payment
checkout
fulfillment
tracking
reviews
```

Exit criteria:

The entire buyer → auction → seller loop works.

---

## MILESTONE 6 — Polish

Improve:

```text
mobile
motion
SEO
performance
accessibility
empty states
error states
loading states
notifications
```

---

## MILESTONE 7 — Launch Audit

Run:

```text
security audit
RLS audit
auth audit
concurrency testing
responsive testing
browser testing
SEO audit
performance audit
error audit
```

Fix issues rather than merely reporting them.

---

# 49. DEFINITION OF MVP DONE

AUCTA MVP is not done because the homepage looks good.

It is done when this flow works:

```text
Seller signs up
↓
Becomes seller
↓
Creates listing
↓
Configures auction
↓
Admin approves
↓
Auction goes live
↓
Buyer discovers item
↓
Buyer watches
↓
Buyer places proxy bid
↓
Other users compete
↓
Late bid extends auction
↓
Auction closes atomically
↓
Winner is determined
↓
Order generated
↓
Winner pays
↓
Seller ships
↓
Buyer receives
↓
Transaction completes
↓
Buyer reviews seller
↓
Sold price enters historical archive
```

That is the product.

---

# 50. NON-GOALS FOR V1

Do not build yet:

```text
native mobile application
AI valuation
crypto/token integration
internal wallet
social feed
livestream auctions
seller livestreaming
complex recommendations
loyalty points
NFTs
multi-country settlement
automatic authentication center
advanced seller advertising
complex chat
multiple currencies
```

Architecture can remain extensible, but do not over-engineer.

---

# 51. QUALITY BAR

I want AUCTA to feel like a funded consumer startup, not an AI-generated demo.

Every screen must have:

- intentional hierarchy
- strong typography
- precise spacing
- meaningful states
- responsive behavior
- realistic data
- coherent interactions

Avoid lorem ipsum.

Avoid obvious placeholder UI where real product behavior can be implemented.

Do not leave broken buttons.

Do not leave dead routes.

Do not hide implementation failures behind mock UI.

---

# 52. AUTONOMOUS WORK RULES

You are authorized to make reasonable engineering and product decisions within this specification.

Do not repeatedly stop for minor clarification.

If a requirement has multiple reasonable implementations:

1. choose the safest and simplest production-worthy option,
2. document the choice,
3. continue.

Do not remove existing working functionality without understanding it.

Before major changes:

- inspect existing code
- understand current architecture
- preserve valuable work
- use migrations safely

After each milestone:

```text
run typecheck
run lint
run tests
run build
```

Fix failures.

---

# 53. GIT WORKFLOW

Use disciplined commits.

Examples:

```text
feat(auth): implement Supabase authentication
feat(auction): add transactional bidding engine
feat(auction): implement proxy bidding
feat(auction): add anti-sniping extensions
feat(seller): add listing submission flow
feat(admin): add moderation queue
test(auction): cover concurrent bid placement
fix(auth): preserve session after callback
```

Do not make giant unexplained commits.

If using GitHub:

- work through branches
- create PRs for major milestones
- review diffs
- resolve CI failures
- never force-push shared production history unless explicitly required

---

# 54. DEPLOYMENT

Target:

```text
Vercel
+
Supabase
```

Maintain:

```text
local
preview
production
```

separation where possible.

Ensure secrets are never committed.

Provide:

```text
.env.example
```

with explanations.

Before production deployment verify:

```text
auth callback URLs
Supabase site URL
RLS
environment variables
payment webhook configuration
storage permissions
admin access
cron/scheduled auction closing
```

---

# 55. IMPORTANT ENGINEERING REQUIREMENT: AUCTION CLOSING

Do not rely on a browser being open to end an auction.

Auctions must settle from server-side infrastructure.

Design a reliable closing mechanism.

Possible implementation:

```text
scheduled server process
+
database verification
+
idempotent settlement function
```

The settlement operation must be safe to run multiple times.

Pseudo requirement:

```text
settleAuction(auctionId)
```

must be idempotent.

Calling it twice must never create two orders or two winners.

---

# 56. IMPORTANT ENGINEERING REQUIREMENT: SERVER TIME

All auction timing must use authoritative server/database timestamps.

Frontend countdown:

```text
display only
```

Database/server:

```text
authority
```

A user changing their system clock must not affect bidding.

---

# 57. IMPORTANT ENGINEERING REQUIREMENT: MONEY

Centralize all currency operations.

Never:

```javascript
0.1 + 0.2
```

for monetary values.

Represent IDR using integers.

Example:

```text
12500000
```

renders:

```text
Rp 12.500.000
```

---

# 58. FUTURE-READY ARCHITECTURE

Without implementing them now, avoid architectural dead ends for:

```text
authentication centers
professional sellers
seller subscriptions
regional expansion
multiple payment providers
multiple languages
buy-now
offers
live auctions
auction houses
price indices
valuation
seller API
mobile apps
```

But keep the MVP small.

---

# 59. NORTH STAR

AUCTA should eventually answer:

> **What is this object actually worth?**

The answer should be:

> Whatever informed buyers are willing to compete to pay for it.

Every architectural and product decision should reinforce:

```text
TRUST
+
LIQUIDITY
+
PRICE DISCOVERY
+
GREAT OBJECTS
```

---

# START NOW

Begin with **Milestone 0: Contract Freeze**.

Inspect the repository and connected infrastructure first.

Then produce:

1. current-state assessment
2. proposed file structure
3. database schema
4. auction state machine
5. bidding algorithm
6. proxy bidding algorithm
7. anti-sniping algorithm
8. authorization/RLS model
9. payment abstraction
10. milestone execution plan

Then immediately proceed into implementation unless there is a genuine external blocker such as missing credentials or unavailable infrastructure.

Do not stop merely to ask what to build next.

Build AUCTA.
