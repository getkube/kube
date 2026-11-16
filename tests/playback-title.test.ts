import {expect,it} from 'vitest';
import {playbackTitle} from '../src/playback-title';
it('names loading, playing, and paused songs and restores an idle title',()=>{
  expect(playbackTitle({playing:true,loading:false},{title:'One More Time'})).toBe('Kube - [playing One More Time]');
  expect(playbackTitle({playing:false,loading:true},{title:'One More Time'})).toBe('Kube - [loading One More Time]');
  expect(playbackTitle({playing:false,loading:false},{title:'One More Time'})).toBe('Kube - [paused One More Time]');
  expect(playbackTitle({playing:false,loading:false})).toBe('Kube');
});
