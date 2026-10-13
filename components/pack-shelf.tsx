'use client';

import {Check,ChevronRight} from 'lucide-react';
import {packDefinitions} from '@/lib/packs';

export default function PackShelf({selectedId,onChoose}:{selectedId:string;onChoose:(id:string)=>void}) {
  return <section className="pack-shelf" aria-label="Choose a pack">
    {packDefinitions.map(pack=><article className={`pack-shelf-card ${selectedId===pack.id?'selected':''}`} key={pack.id}>
      <img src={pack.image} alt={pack.imageAlt} width={200} height={300}/>
      <div><p className="eyebrow">{pack.kicker}</p><h2>{pack.name}</h2><p>100 Ink · 3 unique base + 1 guaranteed foil</p></div>
      <button type="button" className="button outline" aria-pressed={selectedId===pack.id} onClick={()=>onChoose(pack.id)}>{selectedId===pack.id?<Check size={16}/>:<ChevronRight size={16}/>}Choose {pack.name}</button>
    </article>)}
  </section>;
}
