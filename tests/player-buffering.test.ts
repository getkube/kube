import { afterEach, expect, it, vi } from 'vitest';
import { defaultLibrary, type Track } from '../src/model';
import { Player } from '../src/player';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false }, registerPlugin: () => ({}) }));
vi.mock('../src/api', () => ({ Invidious: class {
  async video(_id: string, _signal: AbortSignal, track: Track) {
    return { track, formats: [{itag:'251',type:'audio/webm; codecs="opus"',bitrate:160000},{itag:'140',type:'audio/mp4',bitrate:128000}] };
  }
  stream(id: string, itag: string) { return `https://audio.invalid/${id}/${itag}`; }
} }));
class TestAudio extends EventTarget {
  static last: TestAudio;
  constructor() { super(); TestAudio.last = this; }
  currentTime = 0; duration = 30; preload = ''; volume = 1; src = ''; error = null; end = 0; plays = 0; muted = false; readyState = 4;
  get buffered() { return {length: this.end ? 1 : 0, start: () => 0, end: () => this.end}; }
  canPlayType() { return 'probably'; }
  removeAttribute() { this.src = ''; }
  load() { this.end = 0; this.currentTime = 0; this.dispatchEvent(new Event('loadedmetadata')); }
  pause() { this.dispatchEvent(new Event('pause')); }
  async play() { if (!this.muted) this.plays++; this.dispatchEvent(new Event('playing')); }
  buffer(end: number) { this.end = end; this.dispatchEvent(new Event('progress')); }
}
const track = (id: string): Track => ({videoId:id,title:id,author:'Artist',authorId:'artist',lengthSeconds:30,videoThumbnails:[],musicVerified:true,musicSource:'youtube-music'});
const settle = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('returns fades to the selected volume and ignores excluded listens',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Audio',TestAudio);vi.stubGlobal('navigator',{});
  const library=defaultLibrary();const record=vi.fn();const player=new Player(()=>library,record);
  try{
    const started=player.play(track('abcdefghijk'));await settle();TestAudio.last.buffer(10);await started;
    await vi.advanceTimersByTimeAsync(300);expect(TestAudio.last.volume).toBeCloseTo(.8);
    library.settings.volume=.25;player.volume(.25);player.pause();await vi.advanceTimersByTimeAsync(100);
    await player.resume();await vi.advanceTimersByTimeAsync(300);expect(TestAudio.last.volume).toBeCloseTo(.25);
    for(let i=1;i<=5;i++){TestAudio.last.currentTime=i;TestAudio.last.dispatchEvent(new Event('timeupdate'));}
    library.tasteExcludedTracks=[{id:'abcdefghijk',title:'Song'}];player.pause();await vi.advanceTimersByTimeAsync(300);expect(record).not.toHaveBeenCalled();
  }finally{player.destroy();}
});

it('pausing during startup prevents delayed playback; a new track replaces the pending buffer', async () => {
  vi.stubGlobal('Audio', TestAudio); vi.stubGlobal('navigator', {});
  const library = defaultLibrary(); const player = new Player(() => library, () => {});
  try {
    const initial = player.play(track('abcdefghijk')); await settle();
    TestAudio.last.buffer(8); await settle(); expect(TestAudio.last.plays).toBe(0);
    player.pause(); await initial;
    TestAudio.last.buffer(15); await settle(); expect(TestAudio.last.plays).toBe(0);
    const resumed = player.resume(); await resumed; expect(TestAudio.last.plays).toBe(1);
    const next = player.play(track('lmnopqrstuv')); await settle();
    const replacement = player.play(track('wxyzabcdefg')); await settle();
    await next; expect(player.snapshot().loading).toBe(true);
    TestAudio.last.buffer(10); await replacement;
    expect(player.current()?.videoId).toBe('wxyzabcdefg'); expect(player.snapshot().playing).toBe(true);
  } finally { player.destroy(); }
});

it('changing quality preserves position and pause state', async () => {
  vi.stubGlobal('Audio', TestAudio); vi.stubGlobal('navigator', {});
  const library = defaultLibrary(); const player = new Player(() => library, () => {});
  try {
    const started = player.play(track('abcdefghijk')); await settle(); TestAudio.last.buffer(10); await started;
    player.seek(12); player.pause(); library.settings.audioQuality = 'normal';
    await player.reloadQuality();
    expect(TestAudio.last.src).toContain('/140'); expect(TestAudio.last.currentTime).toBe(12);
    expect(player.snapshot().playing).toBe(false); expect(player.snapshot().loading).toBe(false);
    const resumed = player.resume(); TestAudio.last.buffer(22); await resumed;
    expect(player.snapshot().playing).toBe(true); expect(player.snapshot().position).toBe(12);
  } finally { player.destroy(); }
});
