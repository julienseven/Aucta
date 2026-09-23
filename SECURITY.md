# AUCTA security state

The adopted AUCTA app uses a server-only restricted PostgreSQL login (`aucta_app`). All 16 application tables in the dedicated Supabase project have RLS enabled. `anon` and `authenticated` have no table grants; privileged database access stays in the Next.js server. Server routes must check user, seller, buyer and admin permissions because the server login can access all application records. Supabase Auth and its JWT policies are not used by this version.

Custom session HMAC requires a strong secret and expiring tokens. Email OTP is cryptographically generated, scoped to an email address, atomically consumed and subject to database-backed issuance and guess limits. Hosted email sign-in requires working SMTP. Demo sign-in codes and the development inbox require explicit local demo mode and cannot run on Vercel.

Reserve amounts are kept off client components. Bids, close and unpaid-order expiry lock and recheck database rows. Production manual payments and sample inventory are disabled. Real payment settlement, refund/payout handling, distributed rate limits, hosted multi-connection contention and negative permission tests remain acceptance work. The authenticated close route exists, but no reliable production schedule is configured.
