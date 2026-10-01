import Link from 'next/link';
import {ArrowLeft,BookOpen,Check,Lock,Medal,Sparkles,Trophy} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {cardArtUrl} from '@/lib/card-art';
import './albums.css';

type AlbumCard={
 id:string;
 name:string;
 number:string;
 book:string;
 series:string;
 author:string;
 art?:string;
};

type SeriesAlbum={
 title:string;
 author:string;
 cards:AlbumCard[];
 books:Map<string,AlbumCard[]>;
};

const SERIES_ORDER=['Warlock','Coven King','Dungeon Diving 101–104','Into Darkness','Ruinous Love Trilogy','Slaycation'];

function one<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?(value[0]??null):(value??null)}
function pct(value:number,total:number){return total?Math.round((value/total)*100):0}
function cardNumber(value:string){const match=value.match(/\d+/);return match?Number(match[0]):9999}
function normalizeBookLabel(value:string){
 return value
  .replace(/[‐‑‒–—−]/g,'-')
  .replace(/\s*-\s*/g,'–')
  .replace(/\s+/g,' ')
  .trim();
}

export const metadata={
 title:'Collection Albums · Tropeamine Packs',
 description:'Complete book and series albums, unlock badges, and chase master sets.'
};

export default async function AlbumsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 const [cardsResult,collectionResult]=await Promise.all([
  supabase.from('cards').select(`
   id,number,book_range,created_at,
   characters!inner(name,series!inner(title,author,published)),
   variants!inner(id,rating,available,card_assets(id,side,storage_path))
  `).eq('published',true).eq('variants.rating','sfw').eq('variants.available',true).order('created_at',{ascending:true}),
  user?supabase.from('collection_items').select('card_id').eq('user_id',user.id):Promise.resolve({data:[] as {card_id:string}[],error:null})
 ]);

 const owned=new Set<string>((collectionResult.data??[]).map(row=>String(row.card_id)));
 const hasAny=(id:string)=>owned.has(id)||owned.has(`${id}:foil`);
 const hasMaster=(id:string)=>owned.has(id)&&owned.has(`${id}:foil`);
 const cards:AlbumCard[]=[];

 for(const row of (cardsResult.data??[]) as any[]){
  const character=one<any>(row.characters);
  const series=one<any>(character?.series);
  const variant=(Array.isArray(row.variants)?row.variants:[]).find((item:any)=>item?.rating==='sfw'&&item?.available)??one<any>(row.variants);
  if(!character||!series||!variant)continue;
  const front=(Array.isArray(variant.card_assets)?variant.card_assets:[]).find((asset:any)=>asset?.side==='front'&&asset?.id&&asset?.storage_path);
  cards.push({
   id:String(row.id),
   name:String(character.name||'Unnamed character'),
   number:String(row.number||''),
   book:normalizeBookLabel(String(row.book_range||series.title||'Series')),
   series:String(series.title||'Series'),
   author:String(series.author||''),
   art:front?cardArtUrl(String(front.id),String(front.storage_path),'browse'):undefined
  });
 }

 cards.sort((a,b)=>{
  const ai=SERIES_ORDER.indexOf(a.series),bi=SERIES_ORDER.indexOf(b.series);
  const seriesSort=(ai<0?999:ai)-(bi<0?999:bi);
  return seriesSort||a.series.localeCompare(b.series)||cardNumber(a.number)-cardNumber(b.number)||a.name.localeCompare(b.name);
 });

 const albums=new Map<string,SeriesAlbum>();
 for(const card of cards){
  let album=albums.get(card.series);
  if(!album){album={title:card.series,author:card.author,cards:[],books:new Map()};albums.set(card.series,album)}
  album.cards.push(card);
  const bookCards=album.books.get(card.book)??[];
  bookCards.push(card);
  album.books.set(card.book,bookCards);
 }

 const seriesAlbums=[...albums.values()];
 const totalOwned=cards.filter(card=>hasAny(card.id)).length;
 const bookGroups=seriesAlbums.flatMap(album=>[...album.books.values()]);
 const bookBadges=bookGroups.filter(group=>group.length>0&&group.every(card=>hasAny(card.id))).length;
 const seriesBadges=seriesAlbums.filter(album=>album.cards.length>0&&album.cards.every(card=>hasAny(card.id))).length;
 const masterBadges=seriesAlbums.filter(album=>album.cards.length>0&&album.cards.every(card=>hasMaster(card.id))).length;

 return <main className="albums-page">
  <header className="albums-topbar">
   <Link className="albums-brand" href="/"><BookOpen size={21}/>Tropeamine Packs<span>.</span></Link>
   <nav><Link href="/binder"><ArrowLeft size={15}/>Binder</Link><Link href="/odds">Pack odds</Link></nav>
  </header>

  <section className="albums-hero">
   <div><p className="albums-eyebrow">YOUR COLLECTION · AUTOMATICALLY ORGANIZED</p><h1>Collection Albums</h1><p>Every card you pull fills its place automatically. Complete a book, finish a series, then chase the base + foil master badge.</p></div>
   {!user&&<Link className="albums-signin" href="/login?next=/albums">Sign in to track progress</Link>}
  </section>

  <section className="albums-summary" aria-label="Collection progress summary">
   <article><strong>{totalOwned}<small> / {cards.length}</small></strong><span>Characters collected</span></article>
   <article><strong>{bookBadges}<small> / {bookGroups.length}</small></strong><span>Book badges</span></article>
   <article><strong>{seriesBadges}<small> / {seriesAlbums.length}</small></strong><span>Series complete</span></article>
   <article><strong>{masterBadges}<small> / {seriesAlbums.length}</small></strong><span>Master badges</span></article>
  </section>

  <section className="albums-rules">
   <Sparkles size={17}/><p><strong>Any edition counts toward album completion.</strong> A base card or foil unlocks that character slot. Master badges require both base + foil for every character in the series.</p>
  </section>

  <div className="albums-stack">
   {seriesAlbums.map(album=>{
    const collected=album.cards.filter(card=>hasAny(card.id)).length;
    const mastered=album.cards.filter(card=>hasMaster(card.id)).length;
    const completion=pct(collected,album.cards.length);
    const seriesComplete=collected===album.cards.length&&album.cards.length>0;
    const masterComplete=mastered===album.cards.length&&album.cards.length>0;
    const halfway=completion>=50;
    const started=collected>0;
    return <section className="series-album" key={album.title}>
     <div className="series-album-head">
      <div><p className="albums-eyebrow">SERIES ALBUM</p><h2>{album.title}</h2><span>{album.author}</span></div>
      <div className="series-score"><strong>{collected}<small> / {album.cards.length}</small></strong><span>{completion}% complete</span></div>
     </div>
     <div className="album-progress"><span style={{width:`${completion}%`}}/></div>

     <div className="badge-track" aria-label={`${album.title} progressive badges`}>
      <div className={started?'unlocked':''}><Medal size={17}/><span>First Pull<small>{started?'Unlocked':'Collect 1'}</small></span></div>
      <div className={halfway?'unlocked':''}><Sparkles size={17}/><span>Halfway<small>{halfway?'Unlocked':'Reach 50%'}</small></span></div>
      <div className={seriesComplete?'unlocked':''}><Trophy size={17}/><span>Series Complete<small>{seriesComplete?'Unlocked':'Collect all'}</small></span></div>
      <div className={masterComplete?'unlocked master':''}><Trophy size={17}/><span>Master Set<small>{masterComplete?'Unlocked':'Base + foil all'}</small></span></div>
     </div>

     <div className="book-albums">
      {[...album.books.entries()].map(([book,bookCards])=>{
       const bookOwned=bookCards.filter(card=>hasAny(card.id)).length;
       const complete=bookOwned===bookCards.length&&bookCards.length>0;
       return <article className={`book-album ${complete?'complete':''}`} key={book}>
        <div className="book-album-head"><div><span>{complete?<Check size={13}/>:<Lock size={13}/>} {complete?'BOOK BADGE UNLOCKED':'BOOK ALBUM'}</span><h3>{book}</h3></div><strong>{bookOwned}/{bookCards.length}</strong></div>
        <div className="album-card-grid">
         {bookCards.map(card=>{
          const collectedCard=hasAny(card.id);
          const masterCard=hasMaster(card.id);
          return <div className={`album-card-slot ${collectedCard?'owned':'locked'}`} key={card.id}>
           <div className="album-card-art">
            {card.art?<img src={card.art} alt="" loading="lazy"/>:<span>{card.name.charAt(0)}</span>}
            {!collectedCard&&<div className="album-card-lock"><Lock size={18}/></div>}
            {masterCard&&<b>BASE + FOIL</b>}
           </div>
           <div><strong>{card.name}</strong><small>{card.number}</small></div>
          </div>
         })}
        </div>
       </article>
      })}
     </div>
    </section>
   })}
  </div>

  {cardsResult.error&&<p className="albums-error">The live catalog could not be loaded completely. Try again from the binder.</p>}
 </main>;
}
