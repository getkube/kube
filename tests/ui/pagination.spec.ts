import {test,expect} from '@playwright/test';
test('long lists show more and less without discarding saved tracks',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('CapacitorStorage.kube.library.v1',JSON.stringify({version:1,liked:Array.from({length:60},(_,i)=>({videoId:String(i).padStart(11,'a'),title:`Song ${i}`,author:'Artist',authorId:'artist',musicSource:'youtube-music',musicVerified:true,lengthSeconds:200,videoThumbnails:[]})),hidden:[],artists:[],history:[],playlists:[],settings:{instance:'https://music.test',region:'GB',catalogProxy:'',audioQuality:'high',sidebarExpanded:false,rememberHistory:false,autoplay:false,discovery:.35,volume:.8}})));
  await page.route('**/catalog/**',r=>r.fulfill({status:503,body:'Unavailable'}));await page.route('https://music.test/**',r=>r.fulfill({status:404}));
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('navigation',{name:'Library shortcuts'}).getByRole('button',{name:/Liked songs/}).click();
  await expect(page.locator('.track-row')).toHaveCount(24);await page.getByRole('button',{name:'Show more',exact:true}).click();await expect(page.locator('.track-row')).toHaveCount(48);
  await page.getByRole('button',{name:'Show less',exact:true}).click();await expect(page.locator('.track-row')).toHaveCount(24);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('CapacitorStorage.kube.library.v1')!).liked.length)).toBe(60);
});
