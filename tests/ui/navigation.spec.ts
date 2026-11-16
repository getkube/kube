import { test, expect } from '@playwright/test';
test('compact player navigation and persistent playlist creation', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Listen now', exact: true })).toBeVisible();
  await expect(page.locator('.hero')).toHaveCount(0);
  await expect(page.locator('.brand img')).toHaveJSProperty('naturalWidth', 192);
  await page.screenshot({ path: 'test-results/kube-desktop.png', fullPage: true });
  await page.getByRole('navigation', { name: 'Library shortcuts' }).getByRole('button', { name: /Playlists/ }).click();
  await page.getByRole('button', { name: 'New playlist', exact: true }).click();
  await page.getByLabel('Playlist name', { exact: true }).fill('Evening listening');
  await page.getByRole('dialog').getByRole('button', { name: 'Create playlist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evening listening' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Library shortcuts' }).getByRole('button', { name: /Playlists/ }).click();
  await expect(page.getByRole('heading', { name: 'Evening listening' })).toBeVisible();
});
test('mobile layout keeps library and queue controls accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Artists', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your artists' })).toBeVisible();
  await expect(page.getByRole('complementary', {name:'Sidebar'})).toBeHidden();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('navigation', { name: 'Library shortcuts' }).getByRole('button', { name: /Artists/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/kube-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Show queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Up next', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
});

test('player seek and playback controls share a compact row', async ({ page }) => {
  for (const width of [1365, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const seek = await page.getByLabel('Playback position').boundingBox();
    const play = await page.locator('.primary-play').boundingBox();
    expect(seek).not.toBeNull();
    expect(play).not.toBeNull();
    expect(Math.abs(seek!.y + seek!.height / 2 - play!.y - play!.height / 2)).toBeLessThan(5);
    expect((await page.locator('.player-bar').boundingBox())!.height).toBeLessThanOrEqual(76);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('sidebar choice persists and settings cannot scroll the app shell', async ({ page }) => {
  await page.setViewportSize({width: 1200, height: 650});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const rail = page.getByRole('complementary', {name:'Sidebar'});
  await page.getByRole('button', {name:'Expand sidebar', exact:true}).click();
  await expect(rail).toHaveClass(/expanded/);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button', {name:'Collapse sidebar', exact:true})).toBeVisible();
  await rail.getByRole('button', {name:'Settings',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Settings',exact:true})).toBeVisible();
  await page.locator('main').evaluate(node => { node.scrollTop = 100000; });
  await page.locator('main').hover();
  await page.mouse.wheel(0, 100000);
  const scroll = await page.evaluate(() => ({body:scrollY,main:document.querySelector('main')!.scrollTop,max:document.querySelector('main')!.scrollHeight-document.querySelector('main')!.clientHeight}));
  expect(scroll.body).toBe(0); expect(Math.abs(scroll.main-scroll.max)).toBeLessThanOrEqual(1);
  await page.getByRole('button', {name:'Collapse sidebar',exact:true}).click();
  await rail.hover(); await expect(rail).not.toHaveClass(/expanded/);
  await page.getByRole('button', {name:'Player options',exact:true}).click();
  await page.getByRole('menuitem', {name:'Audio quality',exact:true}).click();
  await page.getByRole('radio', {name:/Normal/}).check();
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button', {name:'Expand sidebar',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Player options',exact:true}).click();
  await page.getByRole('menuitem', {name:'Audio quality',exact:true}).click();
  await expect(page.getByRole('radio', {name:/Normal/})).toBeChecked();
});
