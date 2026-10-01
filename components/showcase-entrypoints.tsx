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
    a.className='collector-dashboard-card showcase-dashboard-card';
    a.innerHTML='<span class="showcase-dashboard-icon" aria-hidden="true">✦</span><span><small>SHOWCASE</small><strong>Create & share</strong><em>Quick Create</em></span><span class="showcase-dashboard-arrow" aria-hidden="true">›</span>';
    host.appendChild(a);
   }
  };
  const sync=()=>{
   ensureLink(document.querySelector('.sidebar nav'),'nav');
   const binderHeading=[...document.querySelectorAll('.page-heading')].find(el=>el.querySelector('h1')?.textContent?.trim()==='My binder');
   if(binderHeading)ensureLink(binderHeading,'binder');
   ensureLink(document.querySelector('.collector-dashboard'),'home');
  };
  sync();
  const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true});
  return()=>observer.disconnect()
 },[]);
 return null;
}
