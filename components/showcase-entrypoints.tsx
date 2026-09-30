'use client';

import {useEffect} from 'react';

export default function ShowcaseEntrypoints(){
 useEffect(()=>{
  const href='/showcase';
  const ensureLink=(host:Element|null,kind:'nav'|'binder'|'home')=>{
   if(!host||host.querySelector(`[data-showcase-entry="${kind}"]`))return;
   const a=document.createElement('a');
   a.href=href;a.dataset.showcaseEntry=kind;
   if(kind==='nav'){
    a.className='nav-link showcase-nav-link';
    a.innerHTML='<span class="showcase-nav-icon" aria-hidden="true">✦</span>Create Showcase';
    host.appendChild(a);
   }else if(kind==='binder'){
    a.className='button gold showcase-binder-cta';
    a.textContent='Create Showcase';
    host.appendChild(a);
   }else{
    a.className='showcase-home-card';
    a.innerHTML='<span>CREATE A SHOWCASE</span><strong>Turn your collection into something worth sharing.</strong><small>Quick Create makes a polished image in seconds, or jump into Studio for full control.</small><b>Create yours →</b>';
    host.appendChild(a);
   }
  };
  const sync=()=>{
   ensureLink(document.querySelector('.sidebar nav'),'nav');
   const binderHeading=[...document.querySelectorAll('.page-heading')].find(el=>el.querySelector('h1')?.textContent?.trim()==='My binder');
   if(binderHeading)ensureLink(binderHeading,'binder');
   const dashboard=document.querySelector('.collector-dashboard');
   if(dashboard)ensureLink(dashboard.parentElement,'home');
  };
  sync();
  const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true});
  return()=>observer.disconnect()
 },[]);
 return null;
}
