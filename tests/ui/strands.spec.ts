import {test,expect} from '@playwright/test';
test('account Strands renders without blocking account controls',async({page})=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('.account-button').click();
  const canvas=page.locator('.account-strands canvas');await expect(canvas).toHaveCount(1);
  await expect.poll(()=>canvas.evaluate(node=>(node as HTMLCanvasElement).width)).toBeGreaterThan(100);
  expect(await canvas.evaluate(node=>(node as HTMLCanvasElement).getContext('webgl2')?.getError())).toBe(0);
  await page.getByLabel('Email address',{exact:true}).fill('render-check@example.invalid');
  await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('render-check@example.invalid');
  await page.screenshot({path:'test-results/kube-strands-account.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
