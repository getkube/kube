import {test,expect} from '@playwright/test';
test('Strands is used by local-only voice search and stops on close',async({page})=>{
  await page.addInitScript(()=>{(window as any).SpeechRecognition=class {
    processLocally=false;lang='';continuous=false;interimResults=false;onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onresult:((event:unknown)=>void)|null=null;onerror:((event:unknown)=>void)|null=null;
    static async available(){return 'available';}
    start(){if(!this.processLocally)throw Error('Remote recognition must never start');(window as any).__voice=this;this.onstart?.();}
    abort(){(window as any).__voiceStopped=true;this.onend?.();}
  };});
  await page.route('**/catalog/**',r=>r.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Voice search',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Voice search',exact:true});await expect(dialog.locator('canvas')).toHaveCount(1);
  expect(await dialog.locator('canvas').evaluate(node=>(node as HTMLCanvasElement).getContext('webgl2')?.getError())).toBe(0);
  await dialog.getByRole('button',{name:'Start listening',exact:true}).click();await expect(dialog.getByText('Listening… say a song or artist.')).toBeVisible();
  await page.evaluate(()=>(window as any).__voice.onresult({results:[[{transcript:'Daft Punk'}]]}));await expect(dialog.getByLabel('Search text')).toHaveValue('Daft Punk');
  await page.screenshot({path:'test-results/kube-strands-voice-search.png'});
  await dialog.getByRole('button',{name:'Search',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('heading',{name:'Results for “Daft Punk”',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__voiceStopped)).toBe(true);await page.locator('.account-button').click();await expect(page.locator('.account-page canvas')).toHaveCount(0);
});
test('recognition without local enforcement is disabled but typing works',async({page})=>{
  await page.addInitScript(()=>{(window as any).SpeechRecognition=class {start(){throw Error('Must not start');}};});
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Voice search',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Voice search',exact:true});
  await expect(dialog.getByRole('button',{name:'Start listening'})).toBeDisabled();await dialog.getByLabel('Search text').fill('Martin Garrix');await dialog.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Results for “Martin Garrix”',exact:true})).toBeVisible();
});
