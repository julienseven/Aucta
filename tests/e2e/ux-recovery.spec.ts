import { expect, test } from '@playwright/test';

test('mobile navigation and search contain keyboard focus and restore their triggers', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const menu=page.getByRole('button',{name:'Open menu',exact:true});
  await menu.click();
  const dialog=page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  for(let index=0;index<12;index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded','false');
  const search=page.getByRole('button',{name:'Search auctions',exact:true});
  await search.click();
  await expect(page.getByRole('textbox',{name:'Search the catalogue'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
});

test('guest bidding returns to confirmation without submitting a bid', async ({page}) => {
  let bids = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/bids')) bids++; });
  await page.goto('/auction/seiko-6139-pogue-chronograph');
  await page.getByRole('button', {name:'Place bid', exact:true}).first().click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.locator('.identity-card').filter({hasText:'Nadia'}).click();
  await expect(page.getByRole('dialog', {name:'Place your bid'})).toBeVisible({timeout:60_000});
  await expect(page.getByLabel('Your maximum (IDR)', {exact:true})).toBeVisible();
  expect(bids).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name:'Place your bid'})).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', {name:'Place your bid'})).not.toBeVisible();
  expect(bids).toBe(0);
});

test('watch recovery preserves filters and requires confirmation', async ({page}) => {
  await page.goto('/auctions?category=watches&q=Seiko');
  await page.getByRole('button',{name:'Add to watchlist',exact:true}).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.locator('.identity-card').filter({hasText:'Aditya'}).click();
  await expect(page.getByRole('button',{name:'Confirm watch',exact:true})).toBeVisible({timeout:60_000});
  expect(new URL(page.url()).searchParams.get('q')).toBe('Seiko');
  expect(new URL(page.url()).searchParams.get('category')).toBe('watches');
  await page.getByRole('button',{name:'Confirm watch',exact:true}).click();
  await expect(page.getByRole('button',{name:'Remove from watchlist',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.getByRole('button',{name:'Confirm watch',exact:true})).not.toBeVisible();
});
