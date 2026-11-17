import {useEffect,useState} from 'react';
import {catalogCredits} from './catalog';
import {type Artist,type Track} from './model';
import {useApp} from './context';
export function ArtistLinks({track,onArtist,className=''}:{track:Track;onArtist:(artist:Artist)=>void;className?:string}){
  const {library}=useApp();const [resolved,setResolved]=useState<Artist[]>([]);
  useEffect(()=>{let active=true;setResolved([]);if(!track.artists?.length&&track.author.includes(','))void catalogCredits(library.settings,track).then(value=>{if(active)setResolved(value);}).catch(()=>{});return()=>{active=false;};},[track.videoId,track.author,track.artists,library.settings.region,library.settings.catalogProxy]);
  const artists=track.artists?.length?track.artists:resolved.length?resolved:track.author.includes(',')?[]:[{author:track.author,authorId:track.authorId}];
  return <span className={`artist-credits ${className}`}>{artists.length?artists.map((artist,index)=><span key={artist.authorId+artist.author+index}>{index>0&&<span className="artist-separator">, </span>}<button className="artist-credit" title={artist.author} onClick={event=>{event.stopPropagation();onArtist(artist);}}>{artist.author}</button></span>):<span title={track.author}>{track.author}</span>}</span>;
}
