import Link from 'next/link';
import {ArrowRight,Diamond,Layers,Library,Sparkles} from 'lucide-react';
import type {ReactNode} from 'react';

type Props = {
  signedIn: boolean;
  total: number;
  base: number;
  foil: number;
  featured: {name:string;author:string;total:number;base:number;foil:number;href:string};
  onVisitFeatured: () => void;
  children: ReactNode;
};

export default function RedesignHome({signedIn,total,base,foil,featured,onVisitFeatured,children}:Props) {
  return <div className="redesign-home">
    <header className="redesign-home-heading">
      <p className="eyebrow">TROPEAMINE PACKS</p>
      <h1>{signedIn?'Welcome to your collection':'Your next obsession'}</h1>
      <p>Collect the characters. Keep the stories.</p>
    </header>
    <section className="redesign-featured-pack" aria-labelledby="featured-pack-title">
      <img src="/packs/haremlit-1-pack-official.webp" alt="HaremLit 1 booster pack artwork" width={230} height={345} fetchPriority="high"/>
      <div><p className="eyebrow">FEATURED COLLECTION</p><h2 id="featured-pack-title">HaremLit 1</h2><p>4 cards · 1 guaranteed foil</p><p className="redesign-pack-series">Warlock · Coven King · Dungeon Diving 101</p></div>
    </section>
    <div className="redesign-home-actions">
      <Link className="button gold" href="/packs"><Layers size={17}/>Open a pack<ArrowRight size={17}/></Link>
      <Link className="button outline" href={signedIn?'/binder':'/discover'}>{signedIn?<Library size={17}/>:<Sparkles size={17}/>} {signedIn?'Visit your binder':'Browse cards'}</Link>
    </div>
    <section className="redesign-collection" aria-labelledby="collection-summary-title">
      <div className="section-title"><h2 id="collection-summary-title">{signedIn?'Your collection':'Start your collection'}</h2><Link className="text-link" href="/binder">My binder <ArrowRight size={16}/></Link></div>
      <div className="redesign-summary-grid">
        <Link href="/binder" className="redesign-summary"><Library size={20}/><span><strong>{base} <small>/ {total}</small></strong><small>BASE CARDS</small></span></Link>
        <Link href="/binder" className="redesign-summary"><Sparkles size={20}/><span><strong>{foil} <small>/ {total}</small></strong><small>FOIL CARDS</small></span></Link>
        <Link href="/binder" className="redesign-summary"><Diamond size={20}/><span><strong>{base+foil} <small>/ {total*2}</small></strong><small>TOTAL EDITIONS</small></span></Link>
      </div>
    </section>
    <section className="redesign-series-chase" aria-labelledby="set-chase-title">
      <div><p className="eyebrow">START A SET CHASE</p><h2 id="set-chase-title">{featured.name}</h2><p>{featured.author}</p><p>{featured.base}/{featured.total} base · {featured.foil}/{featured.total} foil</p><progress aria-label={`${featured.name} base and foil completion`} value={featured.base+featured.foil} max={Math.max(1,featured.total*2)}/></div>
      <Link className="button outline" href={featured.href} onClick={onVisitFeatured}>View the set <ArrowRight size={16}/></Link>
    </section>
    <section className="redesign-chase-cards" aria-labelledby="chase-cards-title">
      <div className="section-title"><h2 id="chase-cards-title">Cards worth chasing</h2><Link className="text-link" href="/discover">Browse all <ArrowRight size={16}/></Link></div>
      <div className="card-grid home-grid chase-grid">{children}</div>
    </section>
    <section className="redesign-how" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <ol><li><b>Pick a pack</b><p>Choose the worlds you want to collect.</p></li><li><b>Reveal your cards</b><p>Three unique base cards and a guaranteed foil.</p></li><li><b>Build your binder</b><p>Keep favorites. Use duplicate Shards to craft missing cards.</p></li></ol>
      <Link className="button gold" href="/quests">Earn Ink <ArrowRight size={16}/></Link>
    </section>
  </div>;
}
