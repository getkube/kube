import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {GripVertical,X,MoreHorizontal} from 'lucide-react';
import type {Track} from './model';
import {useApp} from './context';
import {Cover,IconButton} from './components';

export function QueueList({onAdd}:{onAdd:(track:Track)=>void}) {
  const {player}=useApp();const state=useSyncExternalStore(player.subscribe,player.snapshot);
  const [menu,setMenu]=useState<number|null>(null);
  const [visible,setVisible]=useState(12);
  const root=useRef<HTMLDivElement>(null);
  const drag=useRef<{from:number;to:number;y:number;start:number;active:boolean;scroll:HTMLElement;frame:number}|null>(null);
  const [marker,setMarker]=useState<number|null>(null),[announcement,announce]=useState('');
  function cancel(){if(drag.current)cancelAnimationFrame(drag.current.frame);drag.current=null;setMarker(null);}
  useEffect(()=>()=>{if(drag.current)cancelAnimationFrame(drag.current.frame);},[]);
  useEffect(()=>{cancel();},[state.queue,state.index]);
  function frame(){
    const current=drag.current;if(!current)return;
    if(current.active){
      const rect=current.scroll.getBoundingClientRect();
      if(current.y<rect.top+48)current.scroll.scrollTop-=10;
      else if(current.y>rect.bottom-48)current.scroll.scrollTop+=10;
      const rows=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-queue-index]')||[]).filter(row=>Number(row.dataset.queueIndex)>state.index);
      const over=rows.find(row=>current.y<row.getBoundingClientRect().bottom)||rows.at(-1);
      if(over){current.to=Number(over.dataset.queueIndex);setMarker(current.to);}
    }
    current.frame=requestAnimationFrame(frame);
  }
  return <div className="sortable-queue" ref={root}><p className="queue-hint">Drag upcoming tracks to reorder. Use arrow keys on a handle with a keyboard.</p><span className="sr-only" role="status">{announcement}</span>{state.queue.slice(0,Math.max(visible,state.index+1)).map((track,index)=><div data-queue-index={index} className={`sortable-row ${index===state.index?'current':''} ${marker===index?'drop-target':''}`} key={`${track.videoId}-${index}`}>
    <button className="queue-grip" aria-label={`Reorder ${track.title}`} title="Drag to reorder; arrow keys to move" disabled={index<=state.index}
      onPointerDown={event=>{if(event.button!==0||index<=state.index)return;event.preventDefault();cancel();let scroll=root.current!.parentElement!;while(scroll.parentElement&&scroll.scrollHeight<=scroll.clientHeight)scroll=scroll.parentElement;drag.current={from:index,to:index,y:event.clientY,start:event.clientY,active:false,scroll,frame:0};event.currentTarget.setPointerCapture(event.pointerId);drag.current.frame=requestAnimationFrame(frame);}}
      onPointerMove={event=>{if(drag.current){drag.current.y=event.clientY;if(Math.abs(event.clientY-drag.current.start)>5)drag.current.active=true;}}}
      onPointerUp={event=>{const current=drag.current;if(current?.active){player.reorder(current.from,current.to);announce(`Moved ${track.title} to position ${current.to+1}`);}cancel();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event=>{const to=event.key==='ArrowUp'?index-1:event.key==='ArrowDown'?index+1:event.key==='Home'?state.index+1:event.key==='End'?state.queue.length-1:undefined;if(to!==undefined){event.preventDefault();if(to>state.index&&to<state.queue.length){player.reorder(index,to);announce(`Moved ${track.title} to position ${to+1}`);requestAnimationFrame(()=>root.current?.querySelectorAll<HTMLButtonElement>('.queue-grip')[to]?.focus());}}}}><GripVertical size={20}/></button>
    <button className="queue-song" aria-label={`Play queue song ${index+1}: ${track.title}`} aria-current={index===state.index?'true':undefined} onClick={()=>void player.play(track,state.queue)}><Cover track={track}/><span><strong>{track.title}</strong><small>{track.author}</small></span>{index===state.index&&<small className="queue-now">Now playing</small>}</button>
    <div className="menu-wrap"><IconButton label={`Options for queued ${track.title}`} onClick={()=>setMenu(menu===index?null:index)}><MoreHorizontal size={19}/></IconButton>{menu===index&&<><button className="menu-dismiss" aria-label="Close queue options" onClick={()=>setMenu(null)}/><div className="track-menu" role="menu"><button role="menuitem" onClick={()=>{setMenu(null);onAdd(track);}}>Add to playlist</button></div></>}</div>
    <IconButton label={`Remove queue song ${index+1}`} disabled={index===state.index} onClick={()=>player.remove(index)}><X size={17}/></IconButton>
  </div>)}<div className="track-pagination">{visible<state.queue.length&&<button onClick={()=>setVisible(n=>n+12)}>Show more</button>}{visible>12&&<button onClick={()=>setVisible(12)}>Show less</button>}</div></div>;
}
