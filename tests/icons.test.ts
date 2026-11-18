import {test,expect} from 'vitest';
import sharp from 'sharp';

test('Android adaptive artwork preserves the complete transparent logo',async()=>{
  const foreground='android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png';
  // Keep the 108dp foreground and its centered 46.5dp artwork inside the
  // adaptive icon safe area; no color extraction or trimming may alter it.
  const expected=await sharp('assets/favicons/dark-transparent.png').resize(186,186).ensureAlpha().raw().toBuffer();
  const actual=await sharp(foreground).extract({left:123,top:123,width:186,height:186}).ensureAlpha().raw().toBuffer();
  let alphaDifference=0,colorDifference=0;
  for(let i=0;i<expected.length;i+=4){
    alphaDifference=Math.max(alphaDifference,Math.abs(actual[i+3]-expected[i+3]));
    // Compositing rounds visible RGB by up to one level. Fully transparent
    // RGB is immaterial; its alpha must still match the source exactly.
    if(expected[i+3]>0)for(let c=0;c<3;c++)colorDifference=Math.max(colorDifference,Math.abs(actual[i+c]-expected[i+c]));
  }
  expect(alphaDifference).toBe(0);
  expect(colorDifference).toBeLessThanOrEqual(1);
});
