import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { PlayerState } from './player';
import type { Track } from './model';
export function playbackTitle(state: Pick<PlayerState,'playing'|'loading'>, track?: Pick<Track,'title'>) {
  return track ? `Kube - [${state.loading ? 'loading' : state.playing ? 'playing' : 'paused'} ${track.title}]` : 'Kube';
}
export function usePlaybackTitle(state: PlayerState, track?: Track) {
  const title = playbackTitle(state,track);
  useEffect(()=>{
    document.title = title;
    if (isTauri()) void getCurrentWindow().setTitle(title).catch(()=>{});
  },[title]);
}
