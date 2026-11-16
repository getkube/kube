import { test, expect } from '@playwright/test';
import { createServer, type ServerResponse } from 'node:http';

// The delayed fixture is HTTP on localhost; production media remains HTTPS-only.
test.use({ bypassCSP: true });

test('real audio waits for ten seconds, then plays while the remaining response streams', async ({ page }) => {
  const sampleRate = 22050, bytesPerSecond = sampleRate * 2;
  const wav = Buffer.alloc(44 + bytesPerSecond * 20);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(sampleRate,24); wav.writeUInt32LE(bytesPerSecond,28);
  wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(wav.length-44,40);
  let response: ServerResponse | undefined;
  const server = createServer((_req,res) => {
    response = res;
    res.writeHead(200, {'Content-Type':'audio/wav','Content-Length':wav.length,'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
    res.write(wav.subarray(0,44+8*bytesPerSecond));
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const port = (server.address() as {port:number}).port;
  try {
    await page.goto('/', {waitUntil:'domcontentloaded'});
    await page.getByRole('heading', {name:'Listen now',exact:true}).click();
    await page.evaluate(async url => {
      const modulePath = '/src/audio-quality.ts';
      const {prepareAudio} = await import(modulePath);
      const audio = new Audio(url); audio.preload = 'auto';
      const state = {audio,ready:false,ahead:0,error:''};
      (window as any).__bufferTest = state;
      audio.load();
      void prepareAudio(audio,10,new AbortController().signal,(seconds:number) => {state.ahead=seconds;})
        .then(async () => { await audio.play(); state.ready=true; }).catch((error:Error) => {state.error=error.message;});
    }, `http://127.0.0.1:${port}/audio.wav`);
    await expect.poll(() => page.evaluate(() => (window as any).__bufferTest.ahead)).toBeGreaterThan(5);
    expect(await page.evaluate(() => (window as any).__bufferTest.ready)).toBe(false);
    expect(await page.evaluate(() => (window as any).__bufferTest.audio.muted)).toBe(true);
    response!.write(wav.subarray(44+8*bytesPerSecond,44+12*bytesPerSecond));
    await expect.poll(() => page.evaluate(() => (window as any).__bufferTest.ahead)).toBeGreaterThanOrEqual(10);
    expect(await page.evaluate(() => (window as any).__bufferTest.error)).toBe('');
    await expect.poll(() => page.evaluate(() => (window as any).__bufferTest.ready)).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).__bufferTest.audio.currentTime)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).__bufferTest.audio.muted)).toBe(false);
    expect(await page.evaluate(() => (window as any).__bufferTest.audio.currentTime)).toBeLessThan(2);
    expect(response!.writableEnded).toBe(false);
    response!.end(wav.subarray(44+12*bytesPerSecond));
    await expect.poll(() => page.evaluate(() => (window as any).__bufferTest.audio.buffered.end(0))).toBeGreaterThan(19);
  } finally {
    await page.evaluate(() => { (window as any).__bufferTest?.audio.pause(); });
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
