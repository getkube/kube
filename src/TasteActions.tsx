import {useApp} from './context';
import {artistKey,type Track} from './model';
export function TasteActions({track,close}:{track:Track;close:()=>void}) {
  const {library,update,notify}=useApp();
  const song=library.tasteExcludedTracks.some(t=>t.id===track.videoId), key=artistKey(track), artist=library.tasteExcludedArtists.some(a=>a.key===key);
  return <><button role="menuitem" onClick={()=>{
    update(old=>({...old,tasteExcludedTracks:song?old.tasteExcludedTracks.filter(t=>t.id!==track.videoId):[...old.tasteExcludedTracks,{id:track.videoId,title:track.title}],history:song?old.history:old.history.filter(h=>h.track.videoId!==track.videoId)}));
    notify(song?'Future listening to this song will count toward your taste.':'This song will not be tracked or used for your taste.');close();
  }}>{song?'Use this song for my taste':"Don't use this song for my taste"}</button><button role="menuitem" onClick={()=>{
    update(old=>({...old,tasteExcludedArtists:artist?old.tasteExcludedArtists.filter(a=>a.key!==key):[...old.tasteExcludedArtists,{key,name:track.author}],history:artist?old.history:old.history.filter(h=>artistKey(h.track)!==key)}));
    notify(artist?'Future listening to this artist will count toward your taste.':'Songs by this artist will not be tracked or used for your taste.');close();
  }}>{artist?'Use this artist for my taste':"Don't use this artist for my taste"}</button></>;
}
