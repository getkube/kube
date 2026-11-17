import { TasteActions } from './TasteActions';
import { QueueList } from './QueueList';
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, Plus, X, ArrowUp, ArrowDown, Shuffle, Repeat, MoreHorizontal, Ban } from 'lucide-react';
import { useApp } from './context';
import { Cover, Empty, Failure, IconButton, Loading } from './components';
import { Invidious } from './api';
import { catalogLyrics } from './catalog';
import { duration, type Track } from './model';
import './now-playing.css';

export function NowPlaying({close,onAdd,onArtist}:{close:()=>void;onArtist:(track:Track)=>void;onAdd:(track:Track)=>void}) {
  const {player,library,like,hide} = useApp();
  const state = useSyncExternalStore(player.subscribe,player.snapshot);
  const track = player.current();
  const [visible,setVisible]=useState(24);
  const [menu,setMenu]=useState(false);
  const [tab,setTab] = useState<'queue'|'lyrics'|'related'>('queue');
  const [related,setRelated] = useState<Track[]>([]);
  const [lyrics,setLyrics] = useState({text:'',source:''});
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    setVisible(24);setError(''); setRelated([]); setLyrics({text:'',source:''});
    if (!track || tab === 'queue') {setBusy(false);return;}
    setBusy(true);
    const request = tab === 'lyrics'
      ? catalogLyrics(library.settings,track.videoId,controller.signal).then(value=>{if(!controller.signal.aborted)setLyrics(value);})
      : new Invidious(library.settings).related(track.videoId,controller.signal).then(value=>{if(!controller.signal.aborted)setRelated(value);});
    void request.catch(()=>{if(!controller.signal.aborted)setError(tab === 'lyrics' ? 'Lyrics are unavailable for this track right now.' : 'Related music could not be loaded.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[track?.videoId,tab,retry,library.settings.instance,library.settings.region,library.settings.catalogProxy]);
  return <dialog className="now-playing-screen" aria-label="Now playing" ref={node=>{if(node&&!node.open)node.showModal();}} onCancel={close}>
    <header className="np-header"><IconButton label="Collapse player" onClick={close}><ChevronDown/></IconButton><span/><img src="./logo.png" alt="Kube"/></header>
    {!track ? <Empty title="Nothing playing">Choose a song to start listening.</Empty> : <div className="np-layout">
      <section className="np-main" aria-label="Current track">
        <Cover key={track.videoId} track={track} large square/>
        <div className="np-track-heading"><div><h1 title={track.title}>{track.title}</h1><button className="playing-artist" onClick={()=>onArtist(track)}>{track.author}</button></div><IconButton label="Like current track" active={library.liked.some(t=>t.videoId===track.videoId)} onClick={()=>like(track)}><Heart/></IconButton><IconButton label="Dislike current track" onClick={()=>hide(track)}><Ban/></IconButton><div className="menu-wrap"><IconButton label="Now playing options" onClick={()=>setMenu(!menu)}><MoreHorizontal/></IconButton>{menu&&<><button className="menu-dismiss" aria-label="Close now playing options" onClick={()=>setMenu(false)}/><div className="track-menu" role="menu"><button role="menuitem" onClick={()=>{setMenu(false);onAdd(track);}}>Add to playlist</button><TasteActions track={track} close={()=>setMenu(false)}/></div></>}</div></div>
        <div className="np-seek"><input aria-label="Seek current song" style={{'--progress': `${state.duration ? Math.min(100,state.position/state.duration*100) : 0}%`} as CSSProperties} type="range" min="0" max={state.duration||1} step="0.1" value={Math.min(state.position,state.duration||1)} onChange={e=>player.seek(Number(e.target.value))}/><div><span>{duration(state.position)}</span><span>{duration(state.duration)}</span></div></div>
        <div className="np-controls"><IconButton label="Shuffle queue" onClick={()=>player.shuffle()}><Shuffle/></IconButton><IconButton label="Previous song" onClick={()=>void player.previous()}><SkipBack/></IconButton><IconButton className="np-play" label={state.loading?'Pause buffering':state.playing?'Pause song':'Play song'} onClick={()=>player.toggle()}>{state.loading?<span className="spinner"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</IconButton><IconButton label="Next song" onClick={()=>void player.next()}><SkipForward/></IconButton><IconButton label={`Repeat ${state.repeat}`} active={state.repeat!=='off'} onClick={()=>player.repeat()}><Repeat/></IconButton></div>
        <p className="np-status" role="status">{state.error || (state.loading ? `Buffering ${Math.min(state.buffered,state.bufferTarget).toFixed(1)} / ${state.bufferTarget}s` : state.qualityLabel)}</p>
        {state.error && <button onClick={()=>void player.resume()}>Retry playback</button>}
      </section>
      <aside className="np-panel" aria-label="Listening details">
        <div className="np-tabs" role="tablist" aria-label="Listening details">{(['queue','lyrics','related'] as const).map(name=><button key={name} id={`np-tab-${name}`} role="tab" aria-selected={tab===name} aria-controls="np-content" tabIndex={tab===name?0:-1} onKeyDown={event=>{const names=['queue','lyrics','related'] as const;const index=names.indexOf(name);const next=event.key==='ArrowRight'?names[(index+1)%3]:event.key==='ArrowLeft'?names[(index+2)%3]:undefined;if(next){event.preventDefault();setTab(next);document.getElementById(`np-tab-${next}`)?.focus();}}} onClick={()=>setTab(name)}>{name==='queue'?'Queue':name==='lyrics'?'Lyrics':'Related'}</button>)}</div>
        <div className="np-content" id="np-content" role="tabpanel" aria-labelledby={`np-tab-${tab}`}>
          {tab==='queue' ? <><div className="np-caption"><span>{state.queue.length} tracks</span><span>Now & next</span></div><QueueList onAdd={onAdd}/></> : busy ? <Loading/> : error ? <Failure message={error} retry={()=>setRetry(n=>n+1)}/> : tab==='lyrics' ? lyrics.text ? <><pre className="np-lyrics">{lyrics.text}</pre>{lyrics.source&&<p className="np-source">{lyrics.source}</p>}</> : <Empty title="No lyrics available">This track has no lyrics in the music catalog.</Empty> : related.length ? related.slice(0,visible).map(item=><div className="np-row" key={item.videoId}><button className="np-song" onClick={()=>void player.play(item,[item,...related.filter(t=>t.videoId!==item.videoId)])}><Cover track={item}/><span><strong>{item.title}</strong><small>{item.author}</small></span></button><IconButton label={`Queue ${item.title}`} onClick={()=>player.enqueue(item)}><Plus size={18}/></IconButton></div>) : <Empty title="No related music available">Try another song.</Empty>}
          {tab==='related'&&<div className="track-pagination">{visible<related.length&&<button onClick={()=>setVisible(n=>n+24)}>Show more</button>}{visible>24&&<button onClick={()=>setVisible(24)}>Show less</button>}</div>}
        </div>
      </aside>
    </div>}
  </dialog>;
}
