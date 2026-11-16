export type AudioQuality = 'high' | 'normal' | 'low';
export type AudioFormat = { itag: string; type: string; bitrate: number; url?: string };
export function audioFormats(formats: AudioFormat[], quality: AudioQuality, supported: (type:string)=>boolean) {
  const available = formats.filter(format => supported(format.type)).sort((a,b) => b.bitrate-a.bitrate);
  if (quality === 'high' || !available.length) return available;
  const cap = quality === 'normal' ? 140000 : 64000;
  const selected = available.filter(format => format.bitrate <= cap);
  return selected.length ? selected : [available[available.length-1]];
}
export function formatLabel(format?: AudioFormat) {
  if (!format) return 'No stream selected';
  const codec = format.type.includes('opus') ? 'Opus' : format.type.includes('mp4') ? 'AAC' : 'Audio';
  return codec + ' · ' + Math.round(format.bitrate / 1000) + ' kbps';
}
export function bufferedAhead(audio: Pick<HTMLMediaElement,'buffered'|'currentTime'>) {
  for (let index=0; index<audio.buffered.length; index++) {
    if (audio.buffered.start(index) <= audio.currentTime + .1 && audio.buffered.end(index) > audio.currentTime)
      return Math.max(0,audio.buffered.end(index)-audio.currentTime);
  }
  return 0;
}
export function waitForAudioBuffer(audio: HTMLAudioElement, seconds: number, signal: AbortSignal, progress: (seconds:number)=>void) {
  return new Promise<void>((resolve,reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted','AbortError')); return; }
    const events=['progress','loadedmetadata','canplay','canplaythrough','durationchange','error'];
    let timer: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    function cleanup() {
      events.forEach(name => audio.removeEventListener(name,check));
      signal.removeEventListener('abort',aborted);clearInterval(timer);clearTimeout(timeout);
    }
    function aborted() { cleanup();reject(new DOMException('Aborted','AbortError')); }
    function check() {
      if (audio.error) { cleanup();reject(new Error('The audio source could not be buffered.'));return; }
      const buffered=bufferedAhead(audio);
      const target=Number.isFinite(audio.duration) && audio.duration>0 ? Math.min(seconds,Math.max(0,audio.duration-audio.currentTime)) : seconds;
      progress(Math.min(seconds,buffered));
      if (buffered + .1 >= target && target > 0) { cleanup();resolve(); }
    }
    events.forEach(name=>audio.addEventListener(name,check));
    signal.addEventListener('abort',aborted,{once:true});
    timer=setInterval(check,250);
    timeout=setTimeout(()=>{cleanup();reject(new Error('The instance could not buffer ten seconds of audio. Try another instance or a lower audio quality.'));},45000);
    check();
  });
}

export async function prepareAudio(audio: HTMLAudioElement, seconds: number, signal: AbortSignal, progress: (seconds:number)=>void, position = audio.currentTime) {
  if (signal.aborted) throw new DOMException('Aborted','AbortError');
  const muted = audio.muted, source = audio.src;
  let restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    if (audio.src === source) {
      audio.pause();
      if (audio.readyState >= 1) audio.currentTime = position;
      audio.muted = muted;
    }
  }
  // Chrome may suspend paused preloading before ten seconds. Silent preparation
  // keeps the download active; audible playback always restarts at the requested position.
  signal.addEventListener('abort',restore,{once:true});
  audio.muted = true;
  try {
    await audio.play();
    if (signal.aborted) throw new DOMException('Aborted','AbortError');
    await waitForAudioBuffer(audio,seconds,signal,progress);
  } finally { signal.removeEventListener('abort',restore); restore(); }
}
