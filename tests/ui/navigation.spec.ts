import { test, expect } from '@playwright/test';
test('desktop search, account, and window controls share one top row',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const controls=document.createElement('div');controls.className='window-controls';controls.innerHTML='<button>−</button><button>□</button><button>×</button>';document.querySelector('.topbar')!.append(controls);});
  for(const width of [1365,800,680]){
    await page.setViewportSize({width,height:900});
    const bounds=await Promise.all(['.search-box','.account-button','.window-controls'].map(selector=>page.locator(selector).boundingBox()));
    const centers=bounds.map(box=>box!.y+box!.height/2);expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(2);
    expect(bounds[2]!.x+bounds[2]!.width).toBe(width);expect(bounds[2]!.y).toBe(0);
    expect(bounds[2]!.x-(bounds[1]!.x+bounds[1]!.width)).toBeLessThanOrEqual(14);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
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
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Up next', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
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
    if (width > 560) expect(Math.abs(seek!.y + seek!.height / 2 - play!.y - play!.height / 2)).toBeLessThan(5);
    else { await expect(page.locator('.now-copy')).toBeVisible(); expect(seek!.y).toBeGreaterThan(play!.y); }
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

test('mobile header aligns search and keeps navigation reachable at phone sizes', async ({page}) => {
  for (const width of [320,390,430,560]) {
    await page.setViewportSize({width,height:740});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    const search = await page.locator('.search-box').boundingBox();
    const menu = await page.getByRole('button',{name:'Open navigation'}).boundingBox();
    const account = await page.locator('.account-button').boundingBox();
    expect(search!.x).toBe(16); expect(search!.width).toBe(width-32);
    expect(search!.y).toBeGreaterThanOrEqual(menu!.y+menu!.height);
    expect(menu!.y).toBe(account!.y); expect(menu!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Search',exact:true}).click();
    await expect(page.getByRole('searchbox',{name:'Search music'})).toBeFocused();
    await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Library',exact:true}).click();
    await page.getByRole('navigation',{name:'Your library'}).getByRole('button',{name:'Liked songs'}).click();
    await expect(page.getByRole('heading',{name:'Liked songs',exact:true})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Library',exact:true})).toHaveAttribute('aria-current','page');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
