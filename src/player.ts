import { audioFormats, formatLabel, prepareAudio, type AudioFormat } from './audio-quality';
import { Capacitor } from '@capacitor/core';
import { Invidious } from './api';
import { NativePlayer } from './native';
import { rankRecommendations } from './recommendations';
import { type Library, type Listen, type Track, uniqueTracks, learnsFrom } from './model';

export type PlayerState = {
  buffered: number; bufferTarget: number; qualityLabel: string;
  queue: Track[]; index: number; playing: boolean; loading: boolean;
  position: number; duration: number; error: string; repeat: 'off' | 'all' | 'one';
};
export class Player {
  private state: PlayerState = { buffered: 0, bufferTarget: 10, qualityLabel: 'No stream selected', queue: [], index: -1, playing: false, loading: false, position: 0, duration: 0, error: '', repeat: 'off' };
  private listeners = new Set<() => void>();
  private audio = new Audio();
  private native = Capacitor.isNativePlatform();
  private generation = 0;
  private controller?: AbortController;
  private prefetch?: AbortController;
  private listened = 0;
  private learning = true;
  private started = 0;
  private lastPosition = 0;
  private savedAt = 0;
  private sessionTrack?: Track;
  private sourceIndex = 0;
  private sources: string[] = [];
  private formats: AudioFormat[] = [];
  private buffering?: AbortController;
  private startupReady = false;
  private priming = false;
  private fadeTimer?: ReturnType<typeof setInterval>;
  private cancelFade() { clearInterval(this.fadeTimer); this.fadeTimer=undefined; }
  private fadeTo(target:number,done?:()=>void) {
    this.cancelFade(); const from=this.audio.volume, start=performance.now();
    this.fadeTimer=setInterval(()=>{const fraction=Math.min(1,(performance.now()-start)/250);const end=target===0?0:this.library().settings.volume;this.audio.volume=from+(end-from)*fraction;if(fraction===1){this.cancelFade();done?.();}},16);
  }
  private playIntent = false;
  private startPosition = 0;
  private fallingBack = false;
  private nativePreparing = false;
  private metadataSeek?: () => void;
  private nativeTimer?: ReturnType<typeof setInterval>;
  private handlingEnd = false;
  constructor(private library: () => Library, private record: (listen: Listen) => void) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('timeupdate', () => { if (!this.priming) this.progress(this.audio.currentTime, this.audio.duration); });
    this.audio.addEventListener('playing', () => { if (!this.priming) this.update({ playing: true, loading: false, error: '' }); });
    this.audio.addEventListener('pause', () => { if (!this.priming) { this.update({ playing: false }); this.flush(); } });
    this.audio.addEventListener('waiting', () => { if (this.playIntent) this.update({ loading: true }); });
    this.audio.addEventListener('ended', () => { if (!this.priming) void this.ended(); });
    this.audio.addEventListener('error', () => { void this.fallback(); });
    if (this.native) this.nativeTimer = setInterval(() => { void this.poll(); }, 1000);
    if ('mediaSession' in navigator && !this.native) {
      navigator.mediaSession.setActionHandler('play', () => { void this.resume(); });
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => { void this.next(); });
      navigator.mediaSession.setActionHandler('previoustrack', () => { void this.previous(); });
      navigator.mediaSession.setActionHandler('seekto', d => this.seek(d.seekTime || 0));
      navigator.mediaSession.setActionHandler('seekbackward', d => this.seek(this.state.position - (d.seekOffset || 10)));
      navigator.mediaSession.setActionHandler('seekforward', d => this.seek(this.state.position + (d.seekOffset || 10)));
    }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  current = () => this.state.queue[this.state.index];
  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l());
    if ('mediaSession' in navigator && !this.native) navigator.mediaSession.playbackState = this.state.playing ? 'playing' : 'paused';
  }
  private progress(position: number, duration: number) {
    const eligible = this.current() ? learnsFrom(this.current(),this.library()) : false;
    if (eligible!==this.learning) { this.listened=0;this.savedAt=0;this.started=Date.now();this.learning=eligible; }
    const delta = position - this.lastPosition;
    if (eligible && this.state.playing && delta > 0 && delta < 3) this.listened += delta;
    this.lastPosition = position;
    this.update({ position, duration: Number.isFinite(duration) && duration > 0 ? duration : this.current()?.lengthSeconds || 0 });
    if (this.listened - this.savedAt >= 30) { this.flush(); this.savedAt = this.listened; }
    if ('mediaSession' in navigator && !this.native && this.state.duration > 0) {
      try { navigator.mediaSession.setPositionState({ duration: this.state.duration, position: Math.min(position, this.state.duration), playbackRate: 1 }); } catch { /* Platform lacks position state. */ }
    }
  }
  private async poll() {
    if (this.state.index < 0 || this.nativePreparing) return;
    try {
      const s = await NativePlayer.status();
      if (s.id && s.id !== this.current()?.videoId) {
        const index = this.state.queue.findIndex(t => t.videoId === s.id);
        if (index >= 0) {
          this.flush(true); this.listened = 0; this.savedAt = 0; this.lastPosition = s.position; this.started = Date.now();
          this.sessionTrack = this.state.queue[index]; this.sources = []; this.update({ index });
        }
      }
      this.update({ playing: s.playing, loading: s.loading ?? false, buffered: s.buffered ?? 0 }); this.progress(s.position, s.duration);
      if (s.error && !this.state.error) { if (this.sources.length) await this.fallback(); else this.failPlayback(); }
      if (s.ended && !this.handlingEnd && !this.state.error) await this.ended();
    } catch { this.update({ error: 'Android playback service is unavailable.', playing: false }); }
  }
  private flush(completed = false) {
    const track = this.sessionTrack;
    if (track && learnsFrom(track,this.library()) && this.listened >= 3 && this.library().settings.rememberHistory) this.record({ track, at: this.started, seconds: Math.round(this.listened), completed });
  }
  async play(track: Track, queue: Track[] = [track]) {
    this.flush();
    const list = uniqueTracks(queue.some(t => t.videoId === track.videoId) ? queue : [track, ...queue]);
    this.update({ queue: list, index: list.findIndex(t => t.videoId === track.videoId) });
    await this.load();
  }
  private async load(resumeAt = 0, keepSession = false) {
    const track = this.current(); if (!track) return;
    this.cancelFade();
    const generation = ++this.generation;
    this.prefetch?.abort();
    this.buffering?.abort();
    this.startupReady = false;
    this.startPosition = resumeAt;
    this.nativePreparing = this.native;
    if (!keepSession) this.playIntent = true;
    this.controller?.abort(); this.controller = new AbortController();
    this.sources = []; this.sourceIndex = 0;
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
    if (this.native) await NativePlayer.stop().catch(() => {});
    if (generation !== this.generation) return;
    if (!keepSession) { this.listened = 0; this.savedAt = 0; this.started = Date.now(); }
    this.lastPosition = resumeAt;
    this.sessionTrack = track;
    this.update({ position: resumeAt, duration: track.lengthSeconds, buffered: 0, bufferTarget: Math.min(10, track.lengthSeconds || 10), loading: true, playing: false, error: '' });
    try {
      const api = new Invidious(this.library().settings);
      const detail = await api.video(track.videoId, this.controller.signal, track);
      if (generation !== this.generation) return;
      this.formats = audioFormats(detail.formats, this.library().settings.audioQuality, type => this.native || Boolean(this.audio.canPlayType(type)));
      this.sources = this.formats.map(format => api.stream(track.videoId, format.itag, format.url));
      this.update({ duration: detail.track.lengthSeconds || track.lengthSeconds, bufferTarget: Math.min(10, detail.track.lengthSeconds || 10) });
      if (!this.sources.length) throw new Error('This track has no supported audio stream. It may be restricted or unavailable.');
      if ('mediaSession' in navigator && !this.native) navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.author, album: 'Kube' });
      await this.startSource(generation);
      if (generation === this.generation) this.prefetchNext();
    } catch (e) {
      if (generation === this.generation) { this.nativePreparing = false; this.update({ loading: false, playing: false, error: e instanceof Error ? e.message : 'Could not load track.' }); }
    }
  }
  private async startSource(generation: number) {
    const track = this.current(); if (!track || generation !== this.generation) return;
    this.buffering?.abort();
    this.startupReady = false;
    this.update({ qualityLabel: formatLabel(this.formats[this.sourceIndex]), loading: this.playIntent, buffered: 0 });
    if (this.native) {
      this.nativePreparing = true;
      await NativePlayer.play({ url: this.sources[this.sourceIndex], title: track.title, artist: track.author, id: track.videoId, position: this.startPosition, paused: !this.playIntent, volume: this.library().settings.volume });
      if (generation !== this.generation) return;
      this.nativePreparing = false;
      await NativePlayer.volume({ value: this.library().settings.volume });
      void this.syncNativeQueue().catch(() => {});
    } else {
      if (this.metadataSeek) this.audio.removeEventListener('loadedmetadata', this.metadataSeek);
      const seekStart = () => { if (generation === this.generation && this.startPosition > 0) this.audio.currentTime = this.startPosition; };
      this.metadataSeek = seekStart;
      this.audio.addEventListener('loadedmetadata', seekStart, { once: true });
      this.audio.src = this.sources[this.sourceIndex];
      this.audio.volume = this.library().settings.volume;
      this.audio.load();
      await this.playBuffered(generation);
    }
  }
  private prefetchNext() {
    const next = this.state.queue[this.state.index + 1];
    if (!next || !next.musicVerified) return;
    this.prefetch?.abort(); this.prefetch = new AbortController();
    // Metadata only: no speculative audio downloads or additional catalog searches.
    void new Invidious(this.library().settings).video(next.videoId, this.prefetch.signal, next).catch(() => {});
  }
  private async playBuffered(generation: number) {
    if (generation !== this.generation) return;
    if (!this.playIntent) { this.update({ loading: false }); return; }
    if (!this.startupReady) {
      const controller = new AbortController();
      this.buffering?.abort();
      this.buffering = controller;
      this.priming = true;
      this.update({ loading: true });
      try {
        await prepareAudio(this.audio, 10, controller.signal, seconds => {
          if (generation === this.generation) this.update({ buffered: Math.round(seconds * 10) / 10 });
        }, this.state.position);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          this.update({ loading: false, error: 'Press Play to buffer and start playback.' }); return;
        }
        throw error;
      } finally { if (this.buffering === controller) { this.buffering = undefined; this.priming = false; } }
      if (generation !== this.generation || !this.playIntent) return;
      this.startupReady = true;
    }
    try { if(this.audio.paused)this.audio.volume=0; await this.audio.play(); if(generation!==this.generation||!this.playIntent)return; this.update({playing:true,loading:false,error:''}); this.fadeTo(this.library().settings.volume); }
    catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') this.update({ loading: false, error: 'Your audio is buffered. Press Play to start playback.' });
      else if (!(error instanceof DOMException && ['AbortError', 'NotSupportedError'].includes(error.name))) throw error;
    }
  }
  private async fallback() {
    if (!this.sources.length || this.fallingBack) return;
    this.fallingBack = true;
    const generation = this.generation;
    this.startPosition = this.state.position;
    try {
      while (++this.sourceIndex < Math.min(this.sources.length, 3)) {
        if (generation !== this.generation) return;
        try { await this.startSource(generation); return; } catch { if (generation !== this.generation) return; }
      }
      this.failPlayback();
    } finally { this.fallingBack = false; }
  }
  private failPlayback() { this.nativePreparing = false; this.update({ loading: false, playing: false, error: 'The instance could not serve this audio. Try another track or change the instance in Settings. Your queue is preserved.' }); }
  async resume() {
    if (!this.current()) return;
    this.playIntent = true;
    if (this.state.error && !this.state.error.includes('Press Play')) return this.load(this.state.position, true);
    this.update({ error: '' });
    try {
      if (this.native) { await NativePlayer.resume(); this.update({ loading: true }); }
      else await this.playBuffered(this.generation);
    } catch { this.failPlayback(); }
  }
  pause() {
    this.playIntent = false;
    this.buffering?.abort();
    if (this.native) void NativePlayer.pause().catch(() => this.failPlayback()); else if(this.state.playing&&!this.priming)this.fadeTo(0,()=>{if(!this.playIntent)this.audio.pause();});else{this.cancelFade();this.audio.pause();}
    this.update({ playing: false, loading: false }); this.flush();
  }
  toggle() { if (this.state.playing || (this.playIntent && this.state.loading)) this.pause(); else void this.resume(); }
  async reloadQuality() {
    if (!this.current()) return;
    await this.load(this.state.position, true);
  }
  seek(value: number) {
    const seconds = Math.max(0, Math.min(value, this.state.duration)); this.lastPosition = seconds;
    if (this.native) void NativePlayer.seek({ seconds }).catch(() => this.failPlayback()); else this.audio.currentTime = seconds;
    this.update({ position: seconds });
  }
  volume(value: number) { this.cancelFade(); this.audio.volume = value; if(!this.native&&!this.playIntent)this.audio.pause(); if (this.native) void NativePlayer.volume({ value }).catch(() => {}); }
  private async syncNativeQueue() {
    if (!this.native || !this.current()) return;
    const api = new Invidious(this.library().settings);
    await NativePlayer.upcoming({ tracks: this.state.queue.slice(this.state.index + 1).filter(track => track.musicVerified).map(track => ({ id: track.videoId, title: track.title, artist: track.author, url: api.stream(track.videoId, this.formats[this.sourceIndex]?.itag || (this.library().settings.audioQuality === 'high' ? '251' : this.library().settings.audioQuality === 'low' ? '249' : '140')) })) });
    await NativePlayer.repeat({ mode: this.state.repeat });
  }
  enqueue(track: Track) { this.update({ queue: [...this.state.queue, track] }); void this.syncNativeQueue().catch(() => this.failPlayback()); }
  remove(index: number) {
    if (index === this.state.index) return;
    this.update({ queue: this.state.queue.filter((_, i) => i !== index), index: index < this.state.index ? this.state.index - 1 : this.state.index });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (index <= this.state.index || next <= this.state.index || next >= this.state.queue.length) return;
    const queue = [...this.state.queue]; [queue[index], queue[next]] = [queue[next], queue[index]]; this.update({ queue });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  reorder(from: number, to: number) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from<=this.state.index || to<=this.state.index || from>=this.state.queue.length || to>=this.state.queue.length || from===to) return;
    const queue=[...this.state.queue];const [track]=queue.splice(from,1);queue.splice(to,0,track);
    this.update({queue});this.prefetchNext();void this.syncNativeQueue().catch(()=>this.failPlayback());
  }
  shuffle() {
    const past = this.state.queue.slice(0, this.state.index + 1), future = this.state.queue.slice(this.state.index + 1);
    for (let i = future.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [future[i], future[j]] = [future[j], future[i]]; }
    this.update({ queue: [...past, ...future] });
    void this.syncNativeQueue().catch(() => this.failPlayback());
  }
  repeat() { this.update({ repeat: this.state.repeat === 'off' ? 'all' : this.state.repeat === 'all' ? 'one' : 'off' }); if (this.native) void NativePlayer.repeat({ mode: this.state.repeat }).catch(() => this.failPlayback()); }
  async previous() {
    if (this.state.position > 3) return this.seek(0);
    if (this.state.index > 0) { this.flush(); this.update({ index: this.state.index - 1 }); await this.load(); }
  }
  async next(automatic = false) {
    this.flush(automatic);
    if (automatic && this.state.repeat === 'one') return this.load();
    if (this.state.index + 1 < this.state.queue.length) { this.update({ index: this.state.index + 1 }); return this.load(); }
    if (this.state.repeat === 'all' && this.state.queue.length) { this.update({ index: 0 }); return this.load(); }
    if (this.library().settings.autoplay && this.current()) {
      const generation = this.generation;
      this.update({ loading: true });
      try {
        const api = new Invidious(this.library().settings);
        const related = await api.related(this.current().videoId);
        if (generation !== this.generation) return;
        const queued = new Set(this.state.queue.map(t => t.videoId));
        const candidates = rankRecommendations(related.filter(t => !queued.has(t.videoId)), this.library()).slice(0, 12).map(r => r.track);
        if (candidates.length) { this.update({ queue: [...this.state.queue, ...candidates], index: this.state.queue.length }); return this.load(); }
      } catch (e) { if (generation === this.generation) this.update({ error: e instanceof Error ? e.message : 'Could not extend the queue.' }); }
      if (generation !== this.generation) return;
    }
    this.pause(); this.update({ loading: false });
  }
  private async ended() { this.handlingEnd = true; try { await this.next(true); } finally { this.handlingEnd = false; } }
  stop() {
    this.cancelFade();
    this.prefetch?.abort();
    this.flush(); ++this.generation; this.nativePreparing = false; this.playIntent = false; this.buffering?.abort(); this.controller?.abort(); this.sources = [];
    this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
    if (this.native) void NativePlayer.stop().catch(() => {});
    this.sessionTrack = undefined; this.listened = 0;
    this.update({ playing: false, loading: false, position: 0, error: '', index: -1, queue: [] });
  }
  destroy() { this.stop(); clearInterval(this.nativeTimer); this.listeners.clear(); }
}
