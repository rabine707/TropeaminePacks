'use client';

import {useEffect} from 'react';

const STATE_KEY='tropeamine-packs-v1';
const KNOWN_KEY='tropeamine-packs-known-owned-v1';
const NEW_KEY='tropeamine-packs-new-cards-v1';
const MILESTONE_KEY='tropeamine-packs-milestones-v1';

type LooseCard={id?:unknown;name?:unknown;variant?:unknown;available?:unknown;adult?:unknown;image?:unknown};
type LooseState={wallet?:{owned?:unknown};cards?:LooseCard[]};

function readJson<T>(key:string,fallback:T):T{
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}
}

function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}

export default function CollectionFun(){
 useEffect(()=>{
  let lastSignature='';
  let revealBusy=false;

  const readState=()=>readJson<LooseState>(STATE_KEY,{});
  const cardId=(card:LooseCard)=>String(card.id??'');
  const cardName=(card:LooseCard)=>String(card.name??'').trim();
  const cardVariant=(card:LooseCard)=>String(card.variant??'').trim();

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
    showUnlock(addedCards);
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
    const isOwned=matching.some(card=>owned.has(cardId(card)));
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
    const id=cardId(card),isOwned=owned.has(id);
    let newBadge=tile.querySelector<HTMLSpanElement>('.new-card-badge');
    if(isOwned&&fresh.has(id)){
     if(!newBadge){newBadge=document.createElement('span');newBadge.className='new-card-badge';newBadge.textContent='NEW';tile.querySelector('.art-button')?.appendChild(newBadge)}
    }else newBadge?.remove();
    let hint=tile.querySelector<HTMLDivElement>('.locked-acquire-hint');
    if(!isOwned){
     if(!hint){hint=document.createElement('div');hint.className='locked-acquire-hint';tile.appendChild(hint)}
     const nextText=card.available===false?'Currently unavailable':'Find in packs · Craft for 30 Shards';
     if(hint.textContent!==nextText)hint.textContent=nextText;
    }else hint?.remove();
    const heart=tile.querySelector<HTMLButtonElement>('.heart');
    if(heart&&!isOwned){heart.title='Add to wishlist';heart.setAttribute('aria-label',`Add ${cardName(card)} to wishlist`)}
   });
  }

  function sync(){
   const {cards,owned}=stateParts();
   const signature=JSON.stringify({owned:[...owned].sort(),cards:cards.map(card=>`${cardId(card)}:${cardName(card)}:${cardVariant(card)}`)});
   syncNewCards(cards,owned);
   updatePopular(cards,owned);
   updateTiles(cards,owned);
   if(signature!==lastSignature){syncMilestones(cards,owned);lastSignature=signature}
  }

  function onClick(event:MouseEvent){
   const source=event.target;if(!(source instanceof Element))return;
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
    const {cards,owned}=stateParts();const card=matchCardFromTile(tile,cards);if(!card||!owned.has(cardId(card)))return;
    const fresh=new Set(readJson<string[]>(NEW_KEY,[]).map(String));
    if(fresh.delete(cardId(card))){writeJson(NEW_KEY,[...fresh]);window.setTimeout(sync,0)}
   }
  }

  document.addEventListener('click',onClick,true);
  const timer=window.setInterval(sync,750);
  sync();
  return()=>{document.removeEventListener('click',onClick,true);window.clearInterval(timer)};
 },[]);
 return null;
}
