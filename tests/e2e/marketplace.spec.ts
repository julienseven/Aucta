import { test, expect, type Page } from '@playwright/test';

const WATCH = 'bbbbbbbb-0000-0000-0000-000000000001';
const WATCH_SLUG = '/auction/seiko-6139-pogue-chronograph';
const CAMERA = 'bbbbbbbb-0000-0000-0000-000000000002';
const CAMERA_SLUG = '/auction/hasselblad-500cm-planar';
const origin = 'http://localhost:3100';
async function signIn(page:Page,name:'Nadia'|'Aditya'|'Raka Studio'|'Admin',next='/account') {
  await page.goto('/sign-in?next='+encodeURIComponent(next));
  await page.bringToFront();
  await page.locator('.identity-card').filter({hasText:name}).click();
  await expect(page).toHaveURL(origin+next);
  await expect(page.locator('.account-link')).toContainText(name.split(' ')[0]);
}

test('public catalogue works at all requested widths, with no page errors',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.hero-feature')).toBeVisible();
  await expect(page.locator('.live-section .auction-card').first()).toBeVisible();
  for(const width of [320,375,390,430,768,1280,1600]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  }
  await page.screenshot({path:testInfo.outputPath('home-desktop.png')});
  await page.goto('/auctions?category=watches&q=Seiko');
  await expect(page.locator('.auction-card')).toHaveCount(1);
  await expect(page.locator('.card-title')).toContainText('Seiko');
  await page.goto('/auctions?q=no-such-object-test');
  await expect(page.locator('.empty-state')).toContainText('Nothing matches');
  expect(errors).toEqual([]);
});

test('cookie login and logout update another open tab without stale account controls',async({page,context})=>{
  // Exercise tab switching explicitly; background tabs can be suspended by Chrome.
  test.setTimeout(300_000);
  const other=await context.newPage();await other.goto('/');
  await signIn(page,'Nadia');
  await other.bringToFront();
  await expect(other.locator('.account-link')).toContainText('Nadia');
  await page.bringToFront();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await expect(page.locator('.join-button')).toBeVisible();
  await other.bringToFront();
  await expect(other.locator('.join-button')).toBeVisible();
  await expect(other.locator('.account-link')).toHaveCount(0);
  await other.close();
});

test('protected pages and mutation endpoints reject unauthenticated or wrong-role callers',async({page,request})=>{
  const bid=await request.post('/api/bids',{headers:{origin},data:{auctionId:WATCH,maximum:2500000,idempotencyKey:crypto.randomUUID()}});
  expect(bid.status()).toBe(401);
  await page.goto('/account');await expect(page).toHaveURL(/\/sign-in\?next=/);
  await signIn(page,'Nadia','/admin');
  await expect(page.locator('main')).toContainText('This page is for AUCTA administrators.');
  const badOrigin=await page.request.post('/api/watchlist',{headers:{origin:'https://untrusted.example'},data:{auctionId:WATCH,watching:true}});
  expect(badOrigin.status()).toBe(403);
});

test('two local bidders compete through the UI; private ceilings stay private and watch retries are idempotent',async({page,browser},testInfo)=>{
  const rivalContext=await browser.newContext({baseURL:origin});
  const rival=await rivalContext.newPage();
  try {
    await signIn(page,'Nadia',WATCH_SLUG);
    await page.getByRole('button',{name:'Set max bid',exact:true}).click();
    await page.getByLabel('Maximum bid (IDR)',{exact:true}).fill('5000000');
    await page.getByRole('button',{name:'Save maximum',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.bid-panel')).toContainText('Bid accepted. You are leading.');
    await signIn(rival,'Aditya',WATCH_SLUG);
    await rival.getByRole('button',{name:'Set max bid',exact:true}).click();
    await rival.getByLabel('Maximum bid (IDR)',{exact:true}).fill('3000000');
    await rival.getByRole('button',{name:'Save maximum',exact:true}).click();
    await expect(rival.getByRole('dialog')).not.toBeVisible();
    await expect(rival.locator('.bid-panel')).toContainText('Another collector has an earlier or higher maximum.');
    await page.bringToFront();
    await expect(page.locator('.bid-panel > strong')).toHaveText('Rp 3.050.000',{timeout:20000});
    const response=await rival.request.get('/api/auctions/'+WATCH);
    expect(response.headers()['cache-control']).toContain('no-store');
    const {data}=await response.json();
    expect(data.auction.ownMaximum).toBe(3000000);
    expect(data.auction.isLeading).toBe(false);
    expect(JSON.stringify(data)).not.toContain('5000000');
    await page.request.post('/api/watchlist',{headers:{origin},data:{auctionId:WATCH,watching:true}});
    const first=(await (await page.request.get('/api/auctions/'+WATCH)).json()).data.auction;
    await page.request.post('/api/watchlist',{headers:{origin},data:{auctionId:WATCH,watching:true}});
    const second=(await (await page.request.get('/api/auctions/'+WATCH)).json()).data.auction;
    expect(second.isWatching).toBe(true);expect(second.watchCount).toBe(first.watchCount);
    for(const width of [320,375,390,430,768,1280,1600]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
      if(width<960) await expect(page.locator('.sticky-bid')).toBeVisible();
      else await expect(page.locator('.sticky-bid')).not.toBeVisible();
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:testInfo.outputPath('auction-mobile.png'),fullPage:true});
    await page.route('**/api/auctions/'+WATCH,route=>route.fulfill({status:503,json:{error:'Temporarily unavailable'}}));
    await expect(page.locator('.auction-live .error-banner')).toContainText('Live updates are temporarily unavailable',{timeout:20000});
    await page.unroute('**/api/auctions/'+WATCH);
    await expect(page.locator('.auction-live .error-banner')).toHaveCount(0,{timeout:20000});
  } finally { await rivalContext.close(); }
});

test('seller self-bidding is rejected and settled order data stays participant-scoped',async({page})=>{
  await signIn(page,'Raka Studio',WATCH_SLUG);
  const selfBid=await page.request.post('/api/bids',{headers:{origin},data:{auctionId:WATCH,maximum:10000000,idempotencyKey:crypto.randomUUID()}});
  expect(selfBid.status()).toBe(403);
  await page.goto('/selling');await expect(page.locator('main')).toContainText('Your lots.');
  await page.goto('/sold');await expect(page.locator('.card-title')).toContainText('Air Jordan');
});

test('seller can draft a listing, submit it for review, and keep it out of the catalogue',async({page})=>{
  test.setTimeout(180_000);
  const title='E2E brass field chronograph';
  await signIn(page,'Raka Studio','/selling');
  await page.getByRole('button',{name:'New listing',exact:true}).click();
  await expect(page).toHaveURL(/\/selling\/[0-9a-f-]{36}$/i);
  await expect(page.locator('.listing-writer')).toHaveAttribute('data-ready','true');
  await page.setViewportSize({width:320,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.getByLabel('Title',{exact:true}).fill(title);
  await page.getByLabel('Description',{exact:true}).fill('A considered object for the e2e writer flow with honest notes.');
  await page.getByLabel('Category',{exact:true}).selectOption('watches');
  const sample=page.getByRole('button',{name:'Use /images/watch.png'});
  if(await sample.getAttribute('aria-pressed')!=='true') await sample.click();
  await page.getByLabel('Starting price (IDR)',{exact:true}).fill('1500000');
  await page.getByLabel('Duration',{exact:true}).selectOption('72');
  await expect(page.getByRole('button',{name:'Submit for review',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await expect(page.locator('main')).toContainText(/awaiting moderation/i);
  await expect(page.locator('main')).toContainText(/not live/i);
  await expect(page.locator('main')).toContainText(/not in the catalogue/i);
  await page.goto('/auctions');
  await expect(page.locator('main')).not.toContainText(title);
  await page.goto('/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await signIn(page,'Admin','/admin');
  await expect(page.locator('main')).toContainText('Pending listings');
  await expect(page.locator('main')).toContainText(title);
});

test('admin can approve a pending listing into the catalogue',async({page})=>{
  test.setTimeout(180_000);
  const title='E2E moderated field camera';
  await signIn(page,'Raka Studio','/selling');
  await page.getByRole('button',{name:'New listing',exact:true}).click();
  await expect(page).toHaveURL(/\/selling\/[0-9a-f-]{36}$/i);
  await expect(page.locator('.listing-writer')).toHaveAttribute('data-ready','true');
  await page.getByLabel('Title',{exact:true}).fill(title);
  await page.getByLabel('Description',{exact:true}).fill('A considered object for the e2e moderation flow with honest notes.');
  await page.getByLabel('Category',{exact:true}).selectOption('watches');
  const sample=page.getByRole('button',{name:'Use /images/watch.png'});
  if(await sample.getAttribute('aria-pressed')!=='true') await sample.click();
  await page.getByLabel('Starting price (IDR)',{exact:true}).fill('1500000');
  await page.getByLabel('Duration',{exact:true}).selectOption('72');
  await expect(page.getByRole('button',{name:'Submit for review',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await expect(page.locator('main')).toContainText(/awaiting moderation/i);
  await page.goto('/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await signIn(page,'Admin','/admin');
  await page.setViewportSize({width:320,height:900});
  await expect(page.locator('main')).toContainText(title);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  const row=page.locator('tr',{hasText:title});
  await row.getByLabel('Reason').fill('Approved after editorial review.');
  await row.getByRole('button',{name:'Approve',exact:true}).click();
  await expect(page.locator('section').filter({has:page.getByRole('heading',{name:'Pending listings'})})).not.toContainText(title,{timeout:20_000});
  await page.goto('/auctions');
  await expect(page.locator('main')).toContainText(title,{timeout:20_000});
  await page.goto('/admin');
  await page.setViewportSize({width:320,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test('collector can apply for a seller desk and open selling',async({page})=>{
  test.setTimeout(180_000);
  await signIn(page,'Nadia','/sell');
  await page.getByLabel('Shop name',{exact:true}).fill('Nadia Atelier');
  await page.getByLabel('City',{exact:true}).fill('Jakarta');
  await page.getByLabel('Province',{exact:true}).fill('DKI Jakarta');
  await page.getByRole('button',{name:'Open a seller desk',exact:true}).click();
  await expect(page).toHaveURL(origin+'/selling');
  await expect(page.locator('main')).toContainText('Your lots.');
  await expect(page.getByRole('button',{name:'New listing',exact:true})).toBeVisible();
});

test('winner can mock-pay, seller ships, buyer receives and reviews',async({page,request})=>{
  test.setTimeout(240_000);
  const review='Glass and body as described.';
  await signIn(page,'Nadia',CAMERA_SLUG);
  await expect(page.locator('h1.page-title')).toContainText('Hasselblad');
  const {data}=await(await page.request.get('/api/auctions/'+CAMERA)).json();
  const auction=data.auction;
  if(auction.status==='LIVE'&&Date.parse(auction.endsAt)>Date.parse(auction.serverTime)+10_000){
    const maxBid=page.getByRole('button',{name:'Set max bid',exact:true});
    await expect(maxBid).toBeVisible();
    await maxBid.click();
    // Seed ceiling is 9_000_000; a leader raise must exceed it and does not extend.
    await page.getByLabel('Maximum bid (IDR)',{exact:true}).fill('10000000');
    await page.getByRole('button',{name:'Save maximum',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.bid-panel')).toContainText('Bid accepted. You are leading.');
  }
  await expect.poll(async()=>{
    const {data}=await(await request.get('/api/auctions/'+CAMERA)).json();
    const auction=data.auction;
    return auction.status!=='LIVE'||Date.parse(auction.endsAt)<=Date.parse(auction.serverTime);
  },{timeout:120_000}).toBe(true);
  let closeStatus=0;
  for(let attempt=0;attempt<5;attempt++){
    const close=await request.post('/api/cron/close',{headers:{authorization:'Bearer '+process.env.CRON_SECRET,origin}});
    closeStatus=close.status();
    if(closeStatus===200){
      const {data}=await(await request.get('/api/auctions/'+CAMERA)).json();
      if(data.auction.status!=='LIVE') break;
    }
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  expect(closeStatus).toBe(200);
  const settled=(await(await request.get('/api/auctions/'+CAMERA)).json()).data.auction;
  expect(settled.status,'close returned 200 but Hasselblad produced no order (NO_SALE / no bids)').not.toBe('NO_SALE');
  expect(settled.status,'close returned 200 but Hasselblad is still LIVE').not.toBe('LIVE');
  await page.goto('/account');
  const orderLink=page.locator('a[href^="/orders/"]',{hasText:'Hasselblad'});
  await expect(orderLink,'close returned 200 but no Hasselblad order appeared').toBeVisible();
  const href=await orderLink.getAttribute('href');
  expect(href).toMatch(/^\/orders\/[0-9a-f-]{36}$/i);
  const orderId=String(href).slice('/orders/'.length);
  await orderLink.click();
  await expect(page).toHaveURL(origin+'/orders/'+orderId);
  await page.setViewportSize({width:320,height:900});
  await expect(page.getByRole('button',{name:/Pay Rp/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:/Pay Rp/}).click();
  await expect(page.locator('main')).toContainText('No money is collected');
  await expect(page.locator('main')).toContainText('Paid');
  await expect(page.locator('main')).toContainText('Waiting on the seller to ship');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.goto('/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await signIn(page,'Raka Studio','/orders/'+orderId);
  await page.getByLabel('Carrier',{exact:true}).fill('JNE YES');
  await page.getByLabel('Tracking number',{exact:true}).fill('JNE12345678');
  await page.getByRole('button',{name:'Mark as shipped',exact:true}).click();
  await expect(page.locator('main')).toContainText('in transit');
  await page.goto('/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page).toHaveURL(origin+'/');
  await signIn(page,'Nadia','/orders/'+orderId);
  await page.getByRole('button',{name:'Confirm received',exact:true}).click();
  await expect(page.locator('#order-review')).toBeVisible();
  await page.locator('#order-review').fill(review);
  await page.getByRole('button',{name:'Publish review',exact:true}).click();
  await expect(page.locator('main')).toContainText(review);
  await expect(page.locator('main')).toContainText(/Completed|sale complete/i);
});
