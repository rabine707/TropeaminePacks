'use client';

import {useEffect} from 'react';

const STATE_KEY='tropeamine-packs-v1';
const KNOWN_KEY='tropeamine-packs-known-owned-v1';
const NEW_KEY='tropeamine-packs-new-cards-v1';
const MILESTONE_KEY='tropeamine-packs-milestones-v1';
const FILTERS_KEY='tropeamine-packs-filter-preferences-v1';
const REMEMBERED_FILTERS=['Shelf','Rarity','Genre','Series','Edition'];

type LooseCard={id?:unknown;name?:unknown;variant?:unknown;available?:unknown;adult?:unknown;image?:unknown;series?:unknown};
type LooseState={wallet?:{owned?:unknown};cards?:LooseCard[]};
type FilterPreferences=Record<string,string>;

function readJson<T>(key:string,fallback:T):T{
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
}

function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function slug(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}

export default function CollectionFun(){
 useEffect(()=>{
  let lastSignature='';
  let revealBusy=false;

  const readState=()=>readJson<LooseState>(STATE_KEY,{});
  const cardId=(card:LooseCard)=>String(card.id??'');
  const cardName=(card:LooseCard)=>String(card.name??'').trim();
  const cardVariant=(card:LooseCard)=>String(card.variant??'').trim();
  const cardSeries=(card:LooseCard)=>String(card.series??'').trim();
  const isPublicPreview=(card:LooseCard)=>cardName(card)==='Felicity';

  function stateParts(){
   const state=readState();
   const cards=Array.isArray(state.cards)?state.cards:[];
   const ownedRaw=Array.isArray(state.wallet?.owned)?state.wallet?.owned:[];
   const owned=new Set((ownedRaw||[]).map(String));
   return {state,cards,owned};
  }

  function matchCardFromTile(tile:Element,cards:LooseCard[]){
   const name=tile.querySelector('h3')?.textContent?.trim()||'';
   const variant=tile.querySelector('.tile-info p')?.textContent?.trim()||'';
   return cards.find(card=>cardName(card)===name&&(!variant||cardVariant(card)===variant))||cards.find(card=>cardName(card)===name);
  }

  function toast(message:string){
   let el=document.querySelector<HTMLDivElement>('.collection-fun-toast');
   if(!el){el=document.createElement('div');el.className='collection-fun-toast';el.setAttribute('role','status');document.body.appendChild(el)}
   el.textContent=message;
   el.classList.remove('show');
   requestAnimationFrame(()=>el?.classList.add('show'));
   window.setTimeout(()=>el?.classList.remove('show'),2800);
  }

  function showUnlock(cards:LooseCard[]){
   if(revealBusy||!cards.length)return;
   revealBusy=true;
   const primary=cards[0];
   const overlay=document.createElement('div');overlay.className='new-unlock-overlay';
   const panel=document.createElement('div');panel.className='new-unlock-panel';
   const eyebrow=document.createElement('span');eyebrow.className='new-unlock-eyebrow';eyebrow.textContent=cards.length>1?`${cards.length} NEW CARDS`:'NEW CARD UNLOCKED';
   const art=document.createElement('div');art.className='new-unlock-art';
   const image=String(primary.image??'');
   if(image){const img=document.createElement('img');img.src=image;img.alt='';art.appendChild(img)}else{art.textContent=cardName(primary).charAt(0)||'✦'}
   const title=document.createElement('strong');title.textContent=cardName(primary)||'New collectible';
   const sub=document.createElement('small');sub.textContent=cards.length>1?`${cardName(primary)} + ${cards.length-1} more added to your binder`:'Added to your binder';
   panel.append(eyebrow,art,title,sub);overlay.appendChild(panel);document.body.appendChild(overlay);
   requestAnimationFrame(()=>overlay.classList.add('show'));
   window.setTimeout(()=>{overlay.classList.remove('show');window.setTimeout(()=>{overlay.remove();revealBusy=false},350)},2500);
  }

  function syncNewCards(cards:LooseCard[],owned:Set<string>){
   const current=[...owned];
   const known=readJson<string[]|null>(KNOWN_KEY,null);
   if(known===null){writeJson(KNOWN_KEY,current);return}
   const knownSet=new Set(known.map(String));
   const added=current.filter(id=>!knownSet.has(id));
   if(added.length){
    const existing=new Set(readJson<string[]>(NEW_KEY,[]).map(String));
    added.forEach(id=>existing.add(id));
    writeJson(NEW_KEY,[...existing]);
    const addedCards=added.map(id=>cards.find(card=>cardId(card)===id)).filter((card):card is LooseCard=>Boolean(card));
    // Cloud/local collection hydration is silent. Action-driven pack/craft UI handles celebrations.
    void addedCards;
   }
   if(current.length!==known.length||current.some(id=>!knownSet.has(id)))writeJson(KNOWN_KEY,current);
  }

  function syncMilestones(cards:LooseCard[],owned:Set<string>){
   const sfw=cards.filter(card=>card.adult!==true);
   if(!sfw.length)return;
   const ownedCount=sfw.filter(card=>owned.has(cardId(card))).length;
   const pct=Math.floor((ownedCount/sfw.length)*100);
   const reached=[25,50,75,100].filter(mark=>pct>=mark);
   const celebrated=new Set(readJson<number[]>(MILESTONE_KEY,[]));
   const next=reached.find(mark=>!celebrated.has(mark));
   if(next){celebrated.add(next);writeJson(MILESTONE_KEY,[...celebrated]);toast(next===100?'✦ Collection complete — every card is yours!':`✦ Binder milestone: ${next}% complete`)}
  }

  function updatePopular(cards:LooseCard[],owned:Set<string>){
   document.querySelectorAll<HTMLButtonElement>('.popular-grid button').forEach(button=>{
    const name=button.querySelector('strong')?.textContent?.trim()||'';
    const matching=cards.filter(card=>cardName(card)===name);
    const isOwned=matching.some(card=>owned.has(cardId(card))||owned.has(`${cardId(card)}:foil`)||isPublicPreview(card));
    button.classList.toggle('locked-character',!isOwned);
    button.disabled=!isOwned;
    button.setAttribute('aria-disabled',String(!isOwned));
    button.title=isOwned?`Open ${name}`:'Collect this card to unlock details';
    const badge=button.querySelector<HTMLSpanElement>('.popular-lock-state');
    if(!isOwned){
     if(!badge){
      const nextBadge=document.createElement('span');nextBadge.className='popular-lock-state';nextBadge.innerHTML='<b>LOCKED</b><small>Collect to unlock</small>';button.appendChild(nextBadge);
     }
    }else badge?.remove();
   });
  }

  function updateTiles(cards:LooseCard[],owned:Set<string>){
   const fresh=new Set(readJson<string[]>(NEW_KEY,[]).map(String));
   document.querySelectorAll<HTMLElement>('.card-tile').forEach(tile=>{
    const card=matchCardFromTile(tile,cards);if(!card)return;
    const id=cardId(card),isOwned=owned.has(id)||owned.has(`${id}:foil`)||isPublicPreview(card);
    let newBadge=tile.querySelector<HTMLSpanElement>('.new-card-badge');
    if(isOwned&&(fresh.has(id)||fresh.has(`${id}:foil`))){
     if(!newBadge){newBadge=document.createElement('span');newBadge.className='new-card-badge';newBadge.textContent='NEW';tile.querySelector('.art-button')?.appendChild(newBadge)}
    }else newBadge?.remove();
    let hint=tile.querySelector<HTMLDivElement>('.locked-acquire-hint');
    if(!isOwned){
     if(!hint){hint=document.createElement('div');hint.className='locked-acquire-hint';tile.appendChild(hint)}
     const nextText=card.available===false?'Currently unavailable':'Find in packs · Craft for 200 Shards';
     if(hint.textContent!==nextText)hint.textContent=nextText;
    }else hint?.remove();
    const heart=tile.querySelector<HTMLButtonElement>('.heart');
    if(heart&&!isOwned){heart.title='Add to wishlist';heart.setAttribute('aria-label',`Add ${cardName(card)} to wishlist`)}
   });
  }

  function syncFreshCounter(cards:LooseCard[],owned:Set<string>){
   const fresh=new Set(readJson<string[]>(NEW_KEY,[]).map(String));
   const freshCount=cards.filter(card=>{const id=cardId(card);return (owned.has(id)||owned.has(`${id}:foil`))&&(fresh.has(id)||fresh.has(`${id}:foil`))}).length;
   const heading=[...document.querySelectorAll<HTMLElement>('.page-heading')].find(el=>el.querySelector('h1')?.textContent?.trim()==='My binder');
   const existing=document.querySelector<HTMLAnchorElement>('.fresh-pulls-pill');
   if(!heading||freshCount===0){existing?.remove();return}
   const pill=existing||document.createElement('a');
   pill.className='fresh-pulls-pill';pill.href='/binder';pill.setAttribute('aria-label',`${freshCount} new ${freshCount===1?'card':'cards'} to inspect`);
   pill.innerHTML=`<b>${freshCount}</b><span>NEW ${freshCount===1?'PULL':'PULLS'}<small>Tap cards to clear</small></span>`;
   if(!existing)heading.appendChild(pill);
  }

  function syncRememberedFilters(){
   const filters=document.querySelector<HTMLElement>('.filters');
   if(!filters)return;
   const preferences=readJson<FilterPreferences>(FILTERS_KEY,{});
   for(const label of REMEMBERED_FILTERS){
    const select=filters.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
    const preferred=preferences[label];
    if(!select||!preferred||select.value===preferred||![...select.options].some(option=>option.value===preferred))continue;
    select.value=preferred;select.dispatchEvent(new Event('change',{bubbles:true}));
   }
   const active=Object.entries(preferences).filter(([label,value])=>REMEMBERED_FILTERS.includes(label)&&value&&!value.startsWith('All '));
   let note=filters.querySelector<HTMLDivElement>('.filter-memory-note');
   if(!active.length){note?.remove();return}
   if(!note){note=document.createElement('div');note.className='filter-memory-note';filters.appendChild(note)}
   note.innerHTML=`<span>✦ ${active.length} ${active.length===1?'FILTER':'FILTERS'} REMEMBERED</span><button type="button" class="filter-memory-reset">Reset</button>`;
  }

  function syncDiscoverChase(cards:LooseCard[],owned:Set<string>){
   const discoverHeading=[...document.querySelectorAll<HTMLElement>('.page-heading')].find(el=>el.querySelector('h1')?.textContent?.trim()==='The collection');
   const filters=document.querySelector<HTMLElement>('.filters');
   const existing=document.querySelector<HTMLElement>('.discover-chase');
   if(!discoverHeading||!filters){existing?.remove();return}
   const groups=new Map<string,LooseCard[]>();
   for(const card of cards){
    const name=cardSeries(card);if(card.adult===true||card.available===false||!name)continue;
    groups.set(name,[...(groups.get(name)||[]),card]);
   }
   const series=[...groups.entries()].map(([name,setCards])=>{
    const base=setCards.filter(card=>owned.has(cardId(card))).length;
    const foil=setCards.filter(card=>owned.has(`${cardId(card)}:foil`)).length;
    const total=setCards.length;
    const progress=total?Math.round(((base+foil)/(total*2))*100):0;
    return {name,base,foil,total,progress};
   }).filter(item=>item.total>0).sort((a,b)=>b.progress-a.progress||a.name.localeCompare(b.name));
   if(!series.length){existing?.remove();return}
   const signature=series.map(item=>`${item.name}:${item.base}:${item.foil}:${item.total}`).join('|');
   if(existing?.dataset.signature===signature)return;
   const section=existing||document.createElement('section');section.className='discover-chase';section.dataset.signature=signature;
   const cardsMarkup=series.map(item=>{
    const status=item.base===item.total&&item.foil===item.total?'MASTERED':item.base===item.total?'BASE COMPLETE':item.base===0?'START THE SET':`${item.total-item.base} BASE LEFT`;
    return `<a class="discover-chase-card ${item.progress===100?'mastered':item.base===item.total?'base-complete':''}" href="/series/${slug(item.name)}"><div class="discover-chase-title"><strong>${escapeHtml(item.name)}</strong><span>${status}</span></div><div class="discover-chase-progress"><i style="width:${item.progress}%"></i></div><div class="discover-chase-stats"><span><b>${item.base}</b>/${item.total} Base</span><span><b>${item.foil}</b>/${item.total} Foil</span><em>${item.progress}%</em></div></a>`;
   }).join('');
   section.innerHTML=`<div class="discover-chase-head"><div><span>YOUR SET CHASES</span><strong>See what’s closest to complete.</strong></div><small>Base + foil progress updates with your binder.</small></div><div class="discover-chase-rail">${cardsMarkup}</div>`;
   if(!existing)filters.parentElement?.insertBefore(section,filters);
  }

  function escapeHtml(value:string){
   return value.replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]||char));
  }

  function sync(){
   const {cards,owned}=stateParts();
   const signature=JSON.stringify({owned:[...owned].sort(),cards:cards.map(card=>`${cardId(card)}:${cardName(card)}:${cardVariant(card)}`)});
   syncNewCards(cards,owned);
   updatePopular(cards,owned);
   updateTiles(cards,owned);
   syncFreshCounter(cards,owned);
   syncRememberedFilters();
   syncDiscoverChase(cards,owned);
   if(signature!==lastSignature){syncMilestones(cards,owned);lastSignature=signature}
  }

  function onChange(event:Event){
   const source=event.target;if(!(source instanceof HTMLSelectElement)||!source.closest('.filters'))return;
   const label=source.getAttribute('aria-label')||'';if(!REMEMBERED_FILTERS.includes(label))return;
   const preferences=readJson<FilterPreferences>(FILTERS_KEY,{});
   if(source.value.startsWith('All '))delete preferences[label];else preferences[label]=source.value;
   writeJson(FILTERS_KEY,preferences);window.setTimeout(syncRememberedFilters,0);
  }

  function onClick(event:MouseEvent){
   const source=event.target;if(!(source instanceof Element))return;
   const reset=source.closest('.filter-memory-reset');
   if(reset){
    event.preventDefault();writeJson(FILTERS_KEY,{});
    document.querySelectorAll<HTMLSelectElement>('.filters select').forEach(select=>{
     const all=[...select.options].find(option=>option.value.startsWith('All '));if(!all||select.value===all.value)return;
     select.value=all.value;select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    toast('Collection filters reset');window.setTimeout(syncRememberedFilters,0);return;
   }
   const random=source.closest('button');
   if(random?.textContent?.includes('Random card')){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const ownedButtons=[...document.querySelectorAll<HTMLButtonElement>('.card-tile .art-button')].filter(button=>Boolean(button.querySelector('.owned-badge')));
    if(!ownedButtons.length){toast('No collected cards in this view yet.');return}
    ownedButtons[Math.floor(Math.random()*ownedButtons.length)]?.click();return;
   }
   const artButton=source.closest('.card-tile .art-button');
   if(artButton){
    const tile=artButton.closest('.card-tile');if(!tile)return;
    const {cards,owned}=stateParts();const card=matchCardFromTile(tile,cards);if(!card)return;
    const id=cardId(card);if(!owned.has(id)&&!owned.has(`${id}:foil`))return;
    const fresh=new Set(readJson<string[]>(NEW_KEY,[]).map(String));
    const removedBase=fresh.delete(id),removedFoil=fresh.delete(`${id}:foil`);
    if(removedBase||removedFoil){writeJson(NEW_KEY,[...fresh]);window.setTimeout(sync,0)}
   }
  }

  document.addEventListener('click',onClick,true);
  document.addEventListener('change',onChange,true);
  const timer=window.setInterval(sync,750);
  sync();
  return()=>{document.removeEventListener('click',onClick,true);document.removeEventListener('change',onChange,true);window.clearInterval(timer)};
 },[]);
 return null;
}
