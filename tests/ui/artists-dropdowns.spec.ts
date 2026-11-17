import {test,expect} from '@playwright/test';
test('collaborators underline independently and navigate using their own artist ID',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('CapacitorStorage.kube.library.v1',JSON.stringify({version:1,liked:[{videoId:'abcdefghijk',title:'Collaboration',author:'Alpha, Beta',authorId:'UCAlpha',artists:[{author:'Alpha',authorId:'UCAlpha'},{author:'Beta',authorId:'UCBeta'}],musicSource:'youtube-music',musicVerified:true,lengthSeconds:200,videoThumbnails:[]}],hidden:[],artists:[],history:[],playlists:[],settings:{instance:'https://music.test',region:'GB',catalogProxy:'',audioQuality:'high',sidebarExpanded:false,rememberHistory:false,autoplay:false,discovery:.35,volume:.8}})));
  const ids:string[]=[];await page.route('**/catalog/**',route=>{try{const body=route.request().postDataJSON();if(body.browseId)ids.push(body.browseId);}catch{}return route.fulfill({status:503,body:'Unavailable'});});
  await page.route('https://music.test/**',r=>r.fulfill({status:404}));
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('navigation',{name:'Library shortcuts'}).getByRole('button',{name:/Liked songs/}).click();
  const alpha=page.getByRole('button',{name:'Alpha',exact:true}),beta=page.getByRole('button',{name:'Beta',exact:true});await alpha.hover();
  expect(await alpha.evaluate(node=>getComputedStyle(node).textDecorationLine)).toContain('underline');expect(await beta.evaluate(node=>getComputedStyle(node).textDecorationLine)).toBe('none');
  await beta.click();await expect(page.getByRole('heading',{name:'Beta',exact:true})).toBeVisible();await expect.poll(()=>ids).toContain('UCBeta');
});
test('styled dropdown supports keyboard choice, selection and escape',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
  const select=page.getByRole('combobox',{name:'Music region',exact:true});await select.click();await page.getByRole('option',{name:'United States',exact:true}).click();await expect(select).toHaveText('United States');
  await select.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');await expect(select).toHaveText('United Kingdom');
  await select.click();await page.keyboard.press('Escape');await expect(select).toBeFocused();await expect(select).toHaveAttribute('aria-expanded','false');
});
