# AUCTA roadmap

The user selected `refactor-product-ux-and-motion.zip` on 24 September 2026. The former local PGlite/RPC milestone history describes a different implementation.

The selected Next.js/Drizzle version is connected to a dedicated Supabase database and Vercel project. Production demo inventory, preview email inbox, and manual payment simulation are disabled. The public catalogue begins empty. The app uses custom authentication over PostgreSQL, not Supabase Auth.

Next acceptance work, in order:

1. Verify deployed health, TLS database connection and a two-user sign-in flow after configuring SMTP.
2. Add real, reviewed inventory and test seller, admin and buyer permissions, including negative cases, on hosted PostgreSQL.
3. Provide a durable scheduler fast enough for auction close and payment expiry; Vercel Hobby cron cadence is insufficient.
4. Configure and test real Midtrans payment/webhook, refunds and payout handling. No payment flow is live while `PAYMENT_PROVIDER=disabled`.
5. Complete hosted bid/close contention, privacy, abuse-rate and browser accessibility tests, then operational monitoring and backup/restore review.

See HANDOFF.md for verified results and unresolved risks. Do not mark the marketplace complete from the UI alone.
