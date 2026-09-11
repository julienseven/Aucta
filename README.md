# AUCTA

Auction-first Indonesian collectible marketplace. English first. Money is whole integer IDR only.

This repository is local-only. There is no dedicated AUCTA Supabase project or Vercel deployment. Do not reuse Project Arena infrastructure.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set:

```
AUCTA_LOCAL_MODE=true
APP_URL=http://localhost:3000
LOCAL_AUTH_SECRET=<at least 32 characters>
PAYMENT_PROVIDER=mock
```

3. Install and run on Windows:

```
npm.cmd ci
npm.cmd run dev
```

The app binds to loopback (`127.0.0.1:3000`). Open the exact `APP_URL` origin (`http://localhost:3000`). Do not tunnel or reverse-proxy local mode.

Keep `.env.local` and `.local/` out of Git. The embedded database defaults to `.local/aucta-db`.

## Local identities

Fictional development identities only. Not real accounts or production credentials. Available solely in explicit local mode on loopback.

| Key | Role | Display | Email |
| --- | --- | --- | --- |
| `buyer` | Buyer | Nadia | `buyer@aucta.local` |
| `rival` | Competing buyer | Aditya | `competitor@aucta.local` |
| `seller` | Seller | Raka Studio | `seller@aucta.local` |
| `admin` | Admin | Admin | `admin@aucta.local` |

All sample inventory is fictional development data.

`PAYMENT_PROVIDER=mock` collects no money. Checkout and payment persistence are not connected yet; completed seed orders are fictional fixtures.

## Commands

```
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Local production-build verification uses the same explicit local configuration (`npm.cmd run start` after `build`).

## Current status and verification

Read [HANDOFF.md](HANDOFF.md) before continuing implementation. The working local foundation includes seller drafts/submit and audited listing/seller moderation. Checkout-to-review is not implemented.

Run `npm.cmd run test:e2e` for browser regressions. It builds an isolated localhost:3100 server, uses installed Google Chrome, and creates a fresh `.local/e2e-*` database. Your default `.local/aucta-db` is preserved. Set `AUCTA_LOCAL_DATA_DIR` only to a child of `.local` when running other independent local instances. Restart the server after adding SQL migrations.
