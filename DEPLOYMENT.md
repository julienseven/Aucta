# Deployment

Target later: Vercel plus a newly authorized, dedicated AUCTA Supabase project. Production is not live. Do not reuse Project Arena.

Protected writes fail closed without real Supabase configuration. Local mode and mock payments must be disabled on a hosted host.

## Environment

Copy from `.env.example`. Never commit secrets.

| Variable | Role |
| --- | --- |
| `AUCTA_LOCAL_MODE` | `true` only for loopback development. Hosted deployments must set `false`. |
| `APP_URL` | Exact public origin. HTTPS required when hosted. |
| `LOCAL_AUTH_SECRET` | ≥32 characters. Local signed sessions only. Unused in production. |
| `PAYMENT_PROVIDER` | `mock` is local-only. Disable mock payments when hosted. |
| `AUCTA_LOCAL_DATA_DIR` | Optional PGlite directory. Default `.local/aucta-db`. Local only. |
| `CRON_SECRET` | Bearer token for `/api/cron/close`. Generate before enabling the closer. |
| `NEXT_PUBLIC_SUPABASE_URL` | Dedicated AUCTA project URL. HTTPS. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/publishable key only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never `NEXT_PUBLIC_`. Required for hosted closing. |

Apply and audit migrations before exposing the Data API. Configure SMTP and optional Google OAuth in Supabase. Callback allowlist: `/auth/callback`. Email token-hash: `/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

## Closing cron

`CRON_SECRET` protects `POST /api/cron/close` with `Authorization: Bearer <CRON_SECRET>`. Hosted mode also requires `SUPABASE_SERVICE_ROLE_KEY`. Closing must run on an external cadence independent of open browsers. Never expose the service role key to the client.

Storage policies, upload scanning, Realtime, abuse controls, payment provider credentials/webhooks and payouts remain separate launch gates. Local tests do not verify them.
