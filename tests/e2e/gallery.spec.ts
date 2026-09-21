import { expect, test } from '@playwright/test';

test('auction gallery supports keyboard selection and modal viewing', async ({ page }) => {
  await page.goto('/auction/seiko-6139-pogue-chronograph');

  const first = page.getByRole('button', { name: 'Show image 1 of 2' });
  const second = page.getByRole('button', { name: 'Show image 2 of 2' });
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  await second.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  const frame = page.locator('[data-gallery-frame]');
  await frame.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 250, isPrimary: true });
  await frame.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100, isPrimary: true });
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: /image 2 of 2/ }).first()).toBeVisible();

  const zoom = page.getByRole('button', { name: /Open .* image 2 of 2 full screen/ });
  await zoom.click();
  const dialog = page.getByRole('dialog', { name: 'Full-screen auction image' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByText('Image 1 of 2')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: /Open .* full screen/ })).toBeFocused();
});

test('auction gallery stays within a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/auction/seiko-6139-pogue-chronograph');

  const gallery = page.getByRole('region', { name: 'Auction images' });
  await expect(gallery).toBeVisible();
  const dimensions = await gallery.evaluate((element) => ({
    right: element.getBoundingClientRect().right,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.right).toBeLessThanOrEqual(320);
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});
