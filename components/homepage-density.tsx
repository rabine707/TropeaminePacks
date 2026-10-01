'use client';

import {useEffect} from 'react';

const HOME_CLASS='home-density-v2';
const TITLE_CLASSES=['home-v2-chase-title','home-v2-dashboard-title','home-v2-fresh-title'];

export default function HomepageDensity(){
 useEffect(()=>{
  const sync=()=>{
   const isHome=window.location.pathname==='/'&&Boolean(document.querySelector('.collector-hero'));
   document.documentElement.classList.toggle(HOME_CLASS,isHome);
   document.querySelectorAll<HTMLElement>('.section-title').forEach(el=>el.classList.remove(...TITLE_CLASSES));
   if(!isHome)return;

   for(const title of document.querySelectorAll<HTMLElement>('.section-title')){
    const heading=title.querySelector('h2')?.textContent?.trim();
    if(heading==='Featured set')title.classList.add('home-v2-chase-title');
    if(heading==='What needs your attention')title.classList.add('home-v2-dashboard-title');
    if(heading==='Cards worth chasing')title.classList.add('home-v2-fresh-title');
   }
  };

  const afterNavigation=()=>window.setTimeout(sync,0);
  sync();
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',afterNavigation,true);
  window.addEventListener('popstate',afterNavigation);
  return()=>{
   observer.disconnect();
   document.removeEventListener('click',afterNavigation,true);
   window.removeEventListener('popstate',afterNavigation);
   document.documentElement.classList.remove(HOME_CLASS);
  };
 },[]);
 return null;
}
