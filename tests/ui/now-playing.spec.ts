import {test,expect} from '@playwright/test';

test('expanded player preserves playback, manages queue, exposes tabs and updates the title',async({page})=>{
  const tracks=['abcdefghijk','lmnopqrstuv'].map((videoId,index)=>({videoId,title:`Test song ${index+1}`,author:'Test artist',authorId:'artist',lengthSeconds:20,videoThumbnails:[],musicVerified:true,musicSource:'youtube-music'}));
  await page.addInitScript(liked=>localStorage.setItem('CapacitorStorage.kube.library.v1',JSON.stringify({version:1,liked,hidden:[],artists:[],history:[],playlists:[],settings:{instance:'https://music.test',region:'GB',catalogProxy:'',sidebarExpanded:false,audioQuality:'high',rememberHistory:false,autoplay:false,discovery:.35,volume:.8}})),tracks);
  const wav=Buffer.alloc(44+22050*2*20);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  const metadata=new Map<string,number>();let resolutions=0;
  await page.route('**/catalog/**',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.route('https://music.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/v1/videos/')){
      const id=url.pathname.split('/').pop()!;metadata.set(id,(metadata.get(id)||0)+1);
      expect(url.searchParams.get('local')).toBe('true');
      return route.fulfill({json:{...tracks.find(t=>t.videoId===id),adaptiveFormats:[{itag:'140',type:'audio/wav',bitrate:128000,url:`https://music.test/videoplayback?id=${id}`}],recommendedVideos:[]}});
    }
    if(url.pathname==='/latest_version')resolutions++;
    if(url.pathname==='/videoplayback')return route.fulfill({contentType:'audio/wav',body:wav});
    return route.fulfill({status:404});
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Library shortcuts'}).getByRole('button',{name:/Liked songs/}).click();
  await page.getByRole('button',{name:'Play liked songs',exact:true}).click();
  await expect(page).toHaveTitle('Kube - [playing Test song 1]');
  await expect.poll(()=>metadata.get('lmnopqrstuv')).toBe(1);
  await page.getByRole('button',{name:'Expand now playing'}).click();
  const dialog=page.getByRole('dialog',{name:'Now playing'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Test song 1'})).toBeVisible();
  await dialog.getByRole('tab',{name:'Lyrics',exact:true}).click();
  await expect(dialog.getByText('Lyrics are unavailable for this track right now.')).toBeVisible();
  await dialog.getByRole('tab',{name:'Related',exact:true}).click();
  await expect(dialog.getByText('Related music could not be loaded.')).toBeVisible();
  await dialog.getByRole('tab',{name:'Queue',exact:true}).click();
  await dialog.getByRole('button',{name:'Next song',exact:true}).click();
  await expect(page).toHaveTitle('Kube - [playing Test song 2]');
  expect(metadata.get('lmnopqrstuv')).toBe(1);expect(resolutions).toBe(0);
  await dialog.getByRole('button',{name:'Pause song',exact:true}).click();
  await expect(page).toHaveTitle('Kube - [paused Test song 2]');
  await page.setViewportSize({width:390,height:844});
  await expect(dialog.getByRole('heading',{name:'Test song 2'})).toBeVisible();
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
  await page.screenshot({path:'test-results/kube-now-playing-mobile.png'});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await expect(page).toHaveTitle('Kube - [paused Test song 2]');
});
