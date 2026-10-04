'use client';

import {useEffect} from 'react';

const QUESTS_CLASS='quests-polish';

function setText(node:Element|null,text:string){
 if(node&&node.textContent?.trim()!==text)node.textContent=text;
}

export default function ReviewFixes(){
 useEffect(()=>{
  const sync=()=>{
   const isQuests=window.location.pathname==='/quests';
   document.documentElement.classList.toggle(QUESTS_CLASS,isQuests);
   document.querySelectorAll('.creator-quest-summary').forEach(el=>el.classList.remove('creator-quest-summary'));
   document.querySelectorAll('.creator-poll').forEach(el=>el.classList.remove('creator-poll'));
   if(!isQuests)return;

   for(const section of document.querySelectorAll<HTMLElement>('main section')){
    const title=section.querySelector('.section-title h2');
    if(title?.textContent?.trim()!=='Creator requests'&&title?.textContent?.trim()!=='Creator poll reward')continue;
    section.classList.add('creator-quest-summary');
    setText(title,'Creator poll reward');
    setText(section.querySelector('.section-title .muted'),'Vote below, then claim 50 Ink.');
    const card=section.querySelector('.quest-card');
    setText(card?.querySelector('h3')||null,'Vote in the creator poll');
    setText(card?.querySelector('p')||null,'Choose one character below. Your vote helps decide the next foil edition.');
    const pending=card?.querySelector('.quest-action .muted');
    if(pending)setText(pending,'Vote in poll below');
   }

   const poll=document.querySelector<HTMLElement>('.poll.panel');
   if(poll){
    poll.classList.add('creator-poll');
    setText(poll.querySelector('.eyebrow'),'CREATOR POLL');
    const copy=[...poll.querySelectorAll('p')].find(p=>!p.classList.contains('eyebrow'));
    setText(copy||null,'Pick one character. You can change your vote until the poll closes.');
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
   document.documentElement.classList.remove(QUESTS_CLASS);
  };
 },[]);
 return null;
}
