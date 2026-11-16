import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioFormats, bufferedAhead, waitForAudioBuffer } from '../src/audio-quality';

const formats = [
  { itag: '140', type: 'audio/mp4', bitrate: 130567 },
  { itag: '251', type: 'audio/webm; codecs="opus"', bitrate: 146555 },
  { itag: '249', type: 'audio/webm; codecs="opus"', bitrate: 54402 },
];
class BufferSource extends EventTarget {
  currentTime = 0;
  duration = 30;
  error = null;
  ranges: [number, number][] = [];
  get buffered() { return { length: this.ranges.length, start: (i: number) => this.ranges[i][0], end: (i: number) => this.ranges[i][1] }; }
  audio() { return this as unknown as HTMLAudioElement; }
  buffer(end: number) { this.ranges = [[0, end]]; this.dispatchEvent(new Event('progress')); }
}
afterEach(() => vi.useRealTimers());
describe('audio quality and startup buffering', () => {
  it('selects highest supported quality and caps data saving modes', () => {
    expect(audioFormats(formats, 'high', () => true).map(x => x.itag)).toEqual(['251','140','249']);
    expect(audioFormats(formats, 'normal', () => true)[0].itag).toBe('140');
    expect(audioFormats(formats, 'low', () => true)[0].itag).toBe('249');
    expect(audioFormats(formats, 'high', type => type === 'audio/mp4')[0].itag).toBe('140');
    expect(audioFormats(formats.slice(0,1), 'low', () => true)[0].itag).toBe('140');
  });
  it('waits for ten seconds and counts only contiguous audio ahead of the playhead', async () => {
    vi.useFakeTimers();
    const source = new BufferSource();
    let ready = false;
    const waiting = waitForAudioBuffer(source.audio(), 10, new AbortController().signal, () => {}).then(() => { ready = true; });
    source.buffer(8);
    await Promise.resolve();
    expect(ready).toBe(false);
    source.buffer(10);
    await waiting;
    expect(ready).toBe(true);
    source.currentTime = 12;
    source.ranges = [[0, 10], [12, 27]];
    expect(bufferedAhead(source.audio())).toBe(15);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('starts a short track when fully buffered and cancels pending startup', async () => {
    vi.useFakeTimers();
    const source = new BufferSource(); source.duration = 4;
    const waiting = waitForAudioBuffer(source.audio(), 10, new AbortController().signal, () => {});
    source.buffer(4); await waiting;
    source.ranges = [];
    const controller = new AbortController();
    const cancelled = waitForAudioBuffer(source.audio(), 10, controller.signal, () => {});
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({name:'AbortError'});
    expect(vi.getTimerCount()).toBe(0);
  });
});
