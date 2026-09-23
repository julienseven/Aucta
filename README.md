# AUCTA

Auction-first Indonesian collectibles marketplace. This repository now uses the product UX and motion version supplied as `refactor-product-ux-and-motion.zip` on 24 September 2026.

## Stack and boundaries

Next.js 16, React 19, Drizzle and PostgreSQL. The dedicated Supabase project (`edlvglhxsbigsoubdauj`) hosts the database; AUCTA uses its own email-code/magic-link sessions and server-side database access, not Supabase Auth or a browser Supabase client. The dedicated Vercel project is `aucta` (`prj_BVMbN29i6wlwq07UTciF1MCcYhTN`). Supabase project data is accessed through a restricted `aucta_app` login over the transaction pooler and a verified TLS certificate. Browser Data API roles have no table grants.

## Development

Use Node 22 and `npm.cmd ci`. Provide `DATABASE_URL`, a random `AUCTA_SECRET` of at least 32 characters, and `NEXT_PUBLIC_BASE_URL`. `.env.example` lists other settings. Demo inventory, preview sign-in codes, and manual payments require `AUCTA_DEMO_MODE=true` on a non-hosted local development server with `PAYMENT_PROVIDER=manual`. Production leaves both disabled.

Run `npm.cmd run dev`; then `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`. PostgreSQL mutation tests require an explicitly isolated `TEST_DATABASE_URL`; they never run against `DATABASE_URL` automatically.

## Current launch status

The interface, server routes, and database tables are present. Hosted sign-in requires SMTP; real checkout requires Midtrans credentials and independent webhook verification. The Hobby Vercel plan cannot provide an auction closing cadence through its cron alone, so an external durable scheduler is required before live bidding. Uploaded inventory, provider settlement/refunds, negative permission tests, load tests, and end-to-end buyer/seller acceptance remain launch gates. See [DEPLOYMENT.md](DEPLOYMENT.md) and [HANDOFF.md](HANDOFF.md).
