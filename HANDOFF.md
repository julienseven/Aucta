# AUCTA handoff — 24 September 2026

The user chose `refactor-product-ux-and-motion.zip` as the application version. Its Next.js/Drizzle code replaced the former PGlite/RPC implementation. The ZIP's README was treated as a description to verify, not as an instruction to deploy demo data or turn on payments.

## Connected state

- Dedicated Supabase project: `edlvglhxsbigsoubdauj` (Singapore). Sixteen Drizzle tables were present and empty before this work. All sixteen now have RLS enabled. `anon` and `authenticated` have no table grants; an actual anonymous read of `public.users` was denied. A dedicated `aucta_app` login has server access. Credentials are stored only in ignored local files and encrypted Vercel environment variables.
- The app connects to the verified Singapore transaction pooler on port 6543. Its TLS chain was matched to Supabase's published Root 2021 CA; `src/db/index.ts` verifies the certificate. A direct connection and the pooled connection both succeeded.
- Dedicated Vercel project: `aucta`, ID `prj_BVMbN29i6wlwq07UTciF1MCcYhTN`. Production alias: `https://aucta-two.vercel.app`. Deployment `dpl_JYiQ7gZdEpguNj8bvL7nnVQAMrXj` is READY. Node 22 and the correct public origin are configured. The live `/api/health` returns HTTP 200 with `database: connected`; homepage returns 200.
- Demo seeding, preview sign-in codes/inbox and manual payment confirmation are disabled on the hosted site. Hosted `/api/cron/close` rejects missing credentials. No real inventory is seeded.

## Verification

`npm.cmd run typecheck` passed. `npm.cmd run lint` passed with five warnings. `npm.cmd test` passed 45 tests, including four PostgreSQL integration tests in an isolated `aucta_test` schema on the hosted project. `npm.cmd run build` and both Vercel builds passed. `npm audit` reports four moderate development-tool advisories; the critical/high Next.js, Sharp and PostCSS chain was patched by pinning Next 16.3.6 and PostCSS 8.5.28.

## Not launch-ready

The UI is deployed as a non-transactional preview. Hosted sign-in cannot deliver email until SMTP is configured. No Midtrans credentials or verified live settlement/refund/payout flow is configured; checkout is disabled. Vercel Hobby cron cannot run often enough for auction closing, so a durable external scheduler is required. New authentic inventory, direct negative permission tests for every role, true bid/close contention, two-user browser acceptance, distributed abuse controls, and operational monitoring/backups remain.

This version uses custom application auth and Drizzle server access, not Supabase Auth. Do not apply migrations from the former `supabase/migrations` architecture to the adopted schema.
