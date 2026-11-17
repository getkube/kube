import type {CSSProperties,ReactElement} from 'react';
type Numeric = 'count'|'speed'|'amplitude'|'waviness'|'energy'|'thickness'|'spread'|'glow'|'taper'|'intensity'|'saturation'|'hueShift'|'scale'|'glassSize'|'refraction'|'rim'|'dispersion'|'opacity'|'maxDevicePixelRatio'|'level';
type Flags = 'glass'|'listening'|'interactive'|'clickPulse'|'intro'|'lightMode';
export type StrandsProps = Partial<Record<Numeric,number> & Record<Flags,boolean>> & {colors?:string[];className?:string;style?:CSSProperties};
export default function Strands(props:StrandsProps):ReactElement;
