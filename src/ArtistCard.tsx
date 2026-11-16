import {useEffect,useState} from 'react';
import {Users,Play} from 'lucide-react';
import {type Artist,type Track} from './model';
import {type CatalogArtist} from './catalog';
import {useApp} from './context';
import {Invidious} from './api';
import {Cover} from './components';

export function ArtistPhoto({artist}:{artist:Artist&{photo?:string}}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[artist.authorId,artist.photo]);
  return <div className="artist-photo">{artist.photo&&!failed?<img src={artist.photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Users size={44}/>}</div>;
}
export function ArtistCard({artist,open}:{artist:CatalogArtist;open:(value:Artist)=>void}){
  const {library,player}=useApp();const [songs,setSongs]=useState<Track[]>([]);const [busy,setBusy]=useState(true);const [failed,setFailed]=useState(false);
  useEffect(()=>{const controller=new AbortController();setSongs([]);setBusy(true);setFailed(false);void new Invidious(library.settings).channel(artist.authorId,undefined,controller.signal).then(value=>{if(!controller.signal.aborted)setSongs(value.tracks.slice(0,5));}).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[artist.authorId,library.settings.region,library.settings.catalogProxy]);
  return <section className="artist-spotlight" aria-label={`Featured artist ${artist.author}`}><button className="artist-identity" onClick={()=>open(artist)}><ArtistPhoto artist={artist}/><span>ARTIST</span><h2>{artist.author}</h2><small>View artist profile →</small></button><div className="artist-top-songs"><h3>Popular songs</h3>{busy?<p role="status">Loading artist songs…</p>:songs.length?songs.map((track,index)=><button className="artist-song" key={track.videoId} onClick={()=>void player.play(track,songs)}><span>{index+1}</span><Cover track={track}/><span><strong>{track.title}</strong><small>{track.author}</small></span><Play size={17}/></button>):<p>{failed?'Popular songs could not be loaded. Open the profile to retry.':'No songs available from this artist.'}</p>}</div></section>;
}
