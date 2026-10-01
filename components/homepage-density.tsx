'use client';

import {useEffect} from 'react';

const HOME_CLASS='home-density-v2';
const TITLE_CLASSES=['home-v2-chase-title','home-v2-dashboard-title','home-v2-fresh-title'];
const STORAGE_KEY='tropeamine-packs-v1';

type HomeCard={id:string;series?:string;author?:string;adult?:boolean;image?:string};
type HomeState={cards?:HomeCard[];wallet?:{owned?:string[]}};
type Chase={series:string;author:string;cards:HomeCard[];ownedBase:number;ownedFoil:number;total:number;remainingBase:number;remainingFoil:number};

function normalize(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function readState():HomeState|null{try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw) as HomeState:null}catch{return null}}
function setText(el:HTMLElement|null,text:string){if(el&&el.textContent?.trim()!==text)el.textContent=text}
function setLinkText(link:HTMLAnchorElement|null,text:string){if(link&&link.textContent?.trim()!==text)link.replaceChildren(document.createTextNode(text))}

function chooseChase(state:HomeState|null):Chase|null{
 const cards=(state?.cards??[]).filter(card=>!card.adult&&card.series);
 const owned=new Set(state?.wallet?.owned??[]);
 const groups=new Map<string,HomeCard[]>();
 for(const card of cards){const key=card.series!;groups.set(key,[...(groups.get(key)??[]),card])}
 const chases=[...groups.entries()].map(([series,seriesCards])=>{
  const ownedBase=seriesCards.filter(card=>owned.has(card.id)).length;
  const ownedFoil=seriesCards.filter(card=>owned.has(`${card.id}:foil`)).length;
  return {series,author:seriesCards.find(card=>card.author)?.author??'',cards:seriesCards,ownedBase,ownedFoil,total:seriesCards.length,remainingBase:seriesCards.length-ownedBase,remainingFoil:seriesCards.length-ownedFoil};
 }).filter(chase=>chase.total>0);
 const activeBase=chases.filter(chase=>chase.ownedBase>0&&chase.remainingBase>0).sort((a,b)=>a.remainingBase-b.remainingBase||b.ownedBase-a.ownedBase||a.series.localeCompare(b.series));
 if(activeBase[0])return activeBase[0];
 const foilChase=chases.filter(chase=>chase.ownedBase===chase.total&&chase.remainingFoil>0).sort((a,b)=>a.remainingFoil-b.remainingFoil||b.ownedFoil-a.ownedFoil||a.series.localeCompare(b.series));
 if(foilChase[0])return foilChase[0];
 const untouched=chases.filter(chase=>chase.remainingBase>0).sort((a,b)=>a.total-b.total||a.series.localeCompare(b.series));
 return untouched[0]??chases[0]??null;
}

export default function HomepageDensity(){
 useEffect(()=>{
  const sync=()=>{
   const isHome=window.location.pathname==='/'&&Boolean(document.querySelector('.collector-hero'));
   document.documentElement.classList.toggle(HOME_CLASS,isHome);
   document.querySelectorAll<HTMLElement>('.section-title').forEach(el=>el.classList.remove(...TITLE_CLASSES));
   if(!isHome)return;

   const titles=[...document.querySelectorAll<HTMLElement>('.section-title')];
   const dashboard=titles.find(title=>['What needs your attention','Overview'].includes(title.querySelector('h2')?.textContent?.trim()??''));
   const chaseTitle=titles.find(title=>['Featured set','Continue your chase'].includes(title.querySelector('h2')?.textContent?.trim()??''));
   const fresh=titles.find(title=>['Cards worth chasing','Recently added'].includes(title.querySelector('h2')?.textContent?.trim()??''));

   if(dashboard){
    dashboard.classList.add('home-v2-dashboard-title');
    setText(dashboard.querySelector<HTMLElement>('.eyebrow'),'YOUR COLLECTION');
    setText(dashboard.querySelector<HTMLElement>('h2'),'Overview');
    setLinkText(dashboard.querySelector<HTMLAnchorElement>('a.text-link'),'Binder →');
   }
   if(chaseTitle){
    chaseTitle.classList.add('home-v2-chase-title');
    setText(chaseTitle.querySelector<HTMLElement>('.eyebrow'),'NEXT UP');
    setText(chaseTitle.querySelector<HTMLElement>('h2'),'Continue your chase');
    setLinkText(chaseTitle.querySelector<HTMLAnchorElement>('a.text-link'),'All sets →');
   }
   if(fresh){
    fresh.classList.add('home-v2-fresh-title');
    setText(fresh.querySelector<HTMLElement>('.eyebrow'),'NEW CARDS');
    setText(fresh.querySelector<HTMLElement>('h2'),'Recently added');
    setLinkText(fresh.querySelector<HTMLAnchorElement>('a.text-link'),'Browse →');
   }

   const chase=chooseChase(readState());
   const spotlight=document.querySelector<HTMLElement>('.collectible-spotlight');
   if(!spotlight||!chase)return;
   spotlight.classList.add('home-v2-personal-chase');
   const copy=spotlight.querySelector<HTMLElement>('.spotlight-copy');
   const progress=spotlight.querySelector<HTMLElement>('.set-progress');
   const art=spotlight.querySelector<HTMLElement>('.set-art-image');
   if(art)art.setAttribute('aria-hidden','true');
   if(copy){
    setText(copy.querySelector<HTMLElement>('.pill'),chase.ownedBase?chase.remainingBase?'CLOSEST TO COMPLETE':'BASE SET COMPLETE':'START A SET');
    setText(copy.querySelector<HTMLElement>('h2'),chase.series);
    setText(copy.querySelector<HTMLElement>(':scope > p:not(.chase-copy)'),chase.author||'Tropeamine Packs');
    const tags=copy.querySelectorAll<HTMLElement>('.tags span');
    setText(tags[0]??null,`${chase.ownedBase}/${chase.total} base`);
    setText(tags[1]??null,`${chase.ownedFoil}/${chase.total} foil`);
    setText(copy.querySelector<HTMLElement>('.chase-copy'),chase.remainingBase>0?`${chase.remainingBase} base ${chase.remainingBase===1?'card':'cards'} from completing this set.`:chase.remainingFoil>0?`Base set complete. ${chase.remainingFoil} foil ${chase.remainingFoil===1?'card':'cards'} left to master it.`:'You own every base and foil in this set.');
    const view=copy.querySelector<HTMLAnchorElement>('a.button');
    if(view){const href=`/series/${normalize(chase.series)}`;if(view.getAttribute('href')!==href)view.href=href;setLinkText(view,'View set →')}
    let packs=copy.querySelector<HTMLAnchorElement>('.home-v2-pack-action');
    if(!packs){packs=document.createElement('a');packs.className='button gold home-v2-pack-action';packs.href='/packs';packs.textContent='Open packs';copy.appendChild(packs)}
   }
   if(progress){
    setText(progress.querySelector<HTMLElement>('span'),chase.remainingBase?'BASE SET':'MASTER SET');
    setText(progress.querySelector<HTMLElement>('strong'),chase.remainingBase?`${chase.ownedBase} / ${chase.total}`:`${chase.ownedBase+chase.ownedFoil} / ${chase.total*2}`);
    const bar=progress.querySelector<HTMLProgressElement>('progress');if(bar){bar.max=chase.remainingBase?chase.total:chase.total*2;bar.value=chase.remainingBase?chase.ownedBase:chase.ownedBase+chase.ownedFoil}
    setText(progress.querySelector<HTMLElement>(':scope > p'),chase.remainingBase?`${chase.remainingBase} left to complete the base set`:chase.remainingFoil?`${chase.remainingFoil} foils left to master`:'Master set complete');
   }
  };

  const afterNavigation=()=>window.setTimeout(sync,0);
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',afterNavigation,true);
  window.addEventListener('popstate',afterNavigation);
  window.addEventListener('storage',afterNavigation);
  return()=>{
   observer.disconnect();
   document.removeEventListener('click',afterNavigation,true);
   window.removeEventListener('popstate',afterNavigation);
   window.removeEventListener('storage',afterNavigation);
   document.documentElement.classList.remove(HOME_CLASS);
  };
 },[]);
 return null;
}
