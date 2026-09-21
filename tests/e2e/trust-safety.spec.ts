import { expect, test } from '@playwright/test';

const origin = 'http://localhost:3100';
const rivalId = '00000000-0000-0000-0000-000000000003';
const watchId = 'bbbbbbbb-0000-0000-0000-000000000001';

test('a collector reports a listing and an administrator records a dismissal', async ({ page, browser }) => {
  expect((await page.request.post('/api/auth/local', { headers: { origin }, data: { identity: 'buyer' } })).ok()).toBe(true);
  await page.goto('/auction/seiko-6139-pogue-chronograph');
  const report = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Report this listing' }) });
  await report.locator('summary').click();
  const reason = `Please review the condition description for this watch. Browser report ${Date.now()}.`;
  await report.getByLabel('Reason', { exact: true }).fill(reason);
  await report.getByRole('button', { name: 'Submit report', exact: true }).click();
  await expect(report.getByRole('status')).toContainText('Your report was recorded');

  const adminContext = await browser.newContext({ baseURL: origin });
  try {
    expect((await adminContext.request.post('/api/auth/local', { headers: { origin }, data: { identity: 'admin' } })).ok()).toBe(true);
    const admin = await adminContext.newPage();
    await admin.goto('/admin');
    const record = admin.locator('article').filter({ hasText: reason });
    await record.getByText('Record a decision', { exact: true }).click();
    const dismiss = record.locator('form').filter({ has: admin.getByRole('button', { name: 'Dismiss report', exact: true }) });
    await dismiss.getByLabel('Reason', { exact: true }).fill('Reviewed the listing evidence; no violation is established.');
    await dismiss.getByRole('button', { name: 'Dismiss report', exact: true }).click();
    await expect(record).toContainText(/dismissed/i);
    await admin.reload();
    await expect(admin.locator('article').filter({ hasText: reason })).toContainText(/dismissed/i);
  } finally {
    await adminContext.close();
  }
});

test('confirmed suspension blocks an existing session and restoration permits activity again', async ({ page, browser }) => {
  const rivalContext = await browser.newContext({ baseURL: origin });
  expect((await page.request.post('/api/auth/local', { headers: { origin }, data: { identity: 'admin' } })).ok()).toBe(true);
  try {
    expect((await rivalContext.request.post('/api/auth/local', { headers: { origin }, data: { identity: 'rival' } })).ok()).toBe(true);
    await page.goto('/admin');
    const account = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Aditya', exact: true }) });
    await account.locator('summary').click();
    await account.getByLabel('Reason', { exact: true }).fill('Temporary browser verification of restricted account activity.');
    await account.getByRole('button', { name: 'Suspend account', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Suspend account', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm suspend account', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(account.locator('.badge')).toHaveText('Suspended');

    const denied = await rivalContext.request.post('/api/watchlist', { headers: { origin }, data: { auctionId: watchId, watching: true } });
    expect(denied.ok()).toBe(false);
    expect([401, 403]).toContain(denied.status());

    if (!(await account.locator('details').evaluate(element => element.hasAttribute('open')))) {
      await account.locator('summary').click();
    }
    await account.getByLabel('Reason', { exact: true }).fill('Verification complete; restore the development account.');
    await account.getByRole('button', { name: 'Restore access', exact: true }).click();
    await page.getByRole('dialog', { name: 'Restore access', exact: true }).getByRole('button', { name: 'Confirm restore access', exact: true }).click();
    await expect(account.locator('.badge')).toHaveText('Active');
    expect((await rivalContext.request.post('/api/watchlist', { headers: { origin }, data: { auctionId: watchId, watching: true } })).ok()).toBe(true);
  } finally {
    // A failed browser assertion must not leave the shared fixture suspended.
    await page.request.post(`/api/admin/accounts/${rivalId}/suspension`, { headers: { origin }, data: { suspended: false, reason: 'Restore development account after browser verification.' } });
    await rivalContext.close();
  }
});
