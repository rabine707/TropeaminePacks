import Link from 'next/link';
import {ArrowLeft,BookOpen,Diamond,Info,Layers,Sparkles} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import './odds.css';

type LiveCard={id:string;name:string;series:string};
type PackOdds={id:string;slug:string;name:string;cards:LiveCard[]};

function one<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?(value[0]??null):(value??null)}
function formatPct(value:number){return `${(value*100).toFixed(value<.1?2:1)}%`}

export const metadata={
 title:'Pack Odds · Tropeamine Packs',
 description:'See the live pack pools and current Tropeamine Packs pull odds.'
};

export default async function OddsPage(){
 const supabase=await createClient();
 const [packsResult,membershipsResult,cardsResult]=await Promise.all([
  supabase.from('packs').select('id,slug,name,active,created_at').eq('active',true).order('created_at',{ascending:true}),
  supabase.from('card_pack_memberships').select('pack_id,card_id'),
  supabase.from('cards').select(`id,published,characters!inner(name,series!inner(title)),variants!inner(rating,available)`).eq('published',true).eq('variants.rating','sfw').eq('variants.available',true)
 ]);

 const cardsById=new Map<string,LiveCard>();
 for(const row of (cardsResult.data??[]) as any[]){
  const character=one<any>(row.characters);
  const series=one<any>(character?.series);
  if(!character||!series)continue;
  cardsById.set(String(row.id),{id:String(row.id),name:String(character.name||'Unnamed character'),series:String(series.title||'Series')});
 }

 const memberships=new Map<string,string[]>();
 for(const row of membershipsResult.data??[]){
  const packId=String((row as any).pack_id),cardId=String((row as any).card_id);
  if(!cardsById.has(cardId))continue;
  memberships.set(packId,[...(memberships.get(packId)??[]),cardId]);
 }

 const packs:PackOdds[]=(packsResult.data??[]).map((pack:any)=>({
  id:String(pack.id),slug:String(pack.slug),name:String(pack.name),cards:(memberships.get(String(pack.id))??[]).map(id=>cardsById.get(id)!).filter(Boolean)
 }));

 return <main className="odds-page">
  <header className="odds-topbar">
   <Link className="odds-brand" href="/"><BookOpen size={21}/>Tropeamine Packs<span>.</span></Link>
   <nav><Link href="/packs"><ArrowLeft size={15}/>Packs</Link><Link href="/albums">Albums</Link></nav>
  </header>

  <section className="odds-hero">
   <p className="odds-eyebrow">TRANSPARENT PULL RATES</p>
   <h1>Pack Odds</h1>
   <p>These are the current live rules used by Tropeamine Packs. Every eligible card in a pack pool is equally weighted.</p>
  </section>

  <section className="odds-mechanics">
   <article><Layers size={20}/><div><strong>3 base cards</strong><span>Drawn without replacement, so the three base cards in one pack are different characters.</span></div></article>
   <article><Sparkles size={20}/><div><strong>1 guaranteed foil</strong><span>Drawn independently from the full pack pool. The foil can match one of your three base pulls.</span></div></article>
   <article><Diamond size={20}/><div><strong>Duplicates = 5 Shards</strong><span>Each duplicate base or duplicate foil awards 5 Shards automatically.</span></div></article>
   <article><Info size={20}/><div><strong>100 Ink per pack</strong><span>Rarity labels currently do not change weighting. Every eligible character has the same chance.</span></div></article>
  </section>

  <div className="odds-stack">
   {packs.map(pack=>{
    const total=pack.cards.length;
    const baseChance=total>=3?3/total:0;
    const foilChance=total?1/total:0;
    const anyChance=total>=3?1-((total-3)/total)*((total-1)/total):0;
    const groups=[...pack.cards.reduce((map,card)=>{map.set(card.series,(map.get(card.series)??0)+1);return map},new Map<string,number>()).entries()];
    return <section className="odds-pack" key={pack.id}>
     <div className="odds-pack-head"><div><p className="odds-eyebrow">{pack.slug.toUpperCase()}</p><h2>{pack.name}</h2></div><strong>{total}<small> eligible cards</small></strong></div>
     <div className="odds-rate-grid">
      <article><span>Chance a specific card appears in the 3 base pulls</span><strong>{formatPct(baseChance)}</strong><small>3 of {total} positions across the base draw</small></article>
      <article><span>Chance a specific card is the guaranteed foil</span><strong>{formatPct(foilChance)}</strong><small>1 of {total} equally weighted foil outcomes</small></article>
      <article><span>Chance a specific character appears anywhere in the pack</span><strong>{formatPct(anyChance)}</strong><small>Base, foil, or both in the same pack</small></article>
     </div>
     <div className="odds-pool"><h3>Current pool</h3><div className="odds-series-chips">{groups.map(([series,count])=><span key={series}><strong>{series}</strong>{count} cards</span>)}</div></div>
    </section>
   })}
  </div>

  <section className="odds-note"><Info size={16}/><p><strong>How the math works:</strong> a specific card has a 3/{packs[0]?.cards.length||'N'}-style chance to appear among the three base pulls because those cards are sampled without replacement. The foil is then sampled separately from the full pool. Pool size can change when cards are published, unpublished, or moved between packs, so this page reads the live catalog each time it loads.</p></section>

  {(packsResult.error||membershipsResult.error||cardsResult.error)&&<p className="odds-error">Some live pack data could not be loaded. The pack-opening screen remains the source of truth for availability.</p>}
 </main>;
}
