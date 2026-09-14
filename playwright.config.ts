import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { E2E_CRON_SECRET } from './tests/e2e/cron-secret';

// A separate database and origin keep regression runs out of the user's preview.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { channel: 'chrome', baseURL: 'http://localhost:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    // Reuse only a freshly verified build when iterating on browser tests alone.
    command: (process.env.AUCTA_E2E_SKIP_BUILD === 'true' ? '' : 'npm.cmd run build && ') + `set CRON_SECRET=${E2E_CRON_SECRET}&& node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100`,
    url: 'http://localhost:3100/sign-in',
    // Cold Windows builds can exceed five minutes; surface build output during startup.
    timeout: 900_000,
    stdout: 'pipe',
    reuseExistingServer: false,
    env: { AUCTA_LOCAL_MODE: 'true', APP_URL: 'http://localhost:3100', LOCAL_AUTH_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: E2E_CRON_SECRET, AUCTA_LOCAL_CLOSER: '', PAYMENT_PROVIDER: 'mock', AUCTA_LOCAL_DATA_DIR: '.local/e2e-'+process.pid+'-'+Date.now() },
  },
});
