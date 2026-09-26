'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {BookOpen,Check,Compass,Diamond,Droplets,HelpCircle,Layers,Library,X} from 'lucide-react';

const STATE_KEY='tropeamine-packs-v1';
const INTRO_KEY='tropeamine-onboarding-seen-v1';
const BINDER_KEY='tropeamine-onboarding-binder-v1';
const CHECKLIST_KEY='tropeamine-onboarding-checklist-hidden-v1';

type Snapshot={ink:number;shards:number;opened:number;favorites:number;owned:number;total:number;binderVisited:boolean};
const empty:Snapshot={ink:0,shards:0,opened:0,favorites:0,owned:0,total:0,binderVisited:false};

function readSnapshot():Snapshot{
 try{
  const raw=localStorage.getItem(STATE_KEY);if(!raw)return {...empty,binderVisited:localStorage.getItem(BINDER_KEY)==='1'};
  const state=JSON.parse(raw);
  const cards=Array.isArray(state?.cards)?state.cards.filter((card:any)=>card?.adult!==true):[];
  const ownedIds=new Set(Array.isArray(state?.wallet?.owned)?state.wallet.owned.map(String):[]);
  return {
   ink:Number(state?.wallet?.ink??0),shards:Number(state?.wallet?.shards??0),opened:Number(state?.opened??0),
   favorites:Array.isArray(state?.favorites)?state.favorites.length:0,
   owned:cards.filter((card:any)=>ownedIds.has(String(card?.id))).length,total:cards.length,
   binderVisited:localStorage.getItem(BINDER_KEY)==='1'
  };
 }catch{return empty}
}

export default function CasualGuide(){
 const pathname=usePathname();
 const [welcome,setWelcome]=useState(false),[help,setHelp]=useState(false),[snapshot,setSnapshot]=useState<Snapshot>(empty),[hidden,setHidden]=useState(false);
 useEffect(()=>{
  if(pathname==='/binder')localStorage.setItem(BINDER_KEY,'1');
  setHidden(localStorage.getItem(CHECKLIST_KEY)==='1');
  setWelcome(localStorage.getItem(INTRO_KEY)!=='1');
  const refresh=()=>setSnapshot(readSnapshot());refresh();
  const timer=window.setInterval(refresh,1200);window.addEventListener('storage',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('storage',refresh)};
 },[pathname]);
 const checklist=useMemo(()=>[
  {label:'Open your first pack',done:snapshot.opened>0,href:'/packs'},
  {label:'Visit your Binder',done:snapshot.binderVisited,href:'/binder'},
  {label:'Favorite a character',done:snapshot.favorites>0,href:'/discover'},
 ],[snapshot]);
 const complete=checklist.every(item=>item.done);const done=checklist.filter(item=>item.done).length;
 function markSeen(){try{localStorage.setItem(INTRO_KEY,'1')}catch{}setWelcome(false)}
 function hideChecklist(){try{localStorage.setItem(CHECKLIST_KEY,'1')}catch{}setHidden(true)}
 return <>
  {welcome&&<div className="casual-overlay" role="dialog" aria-modal="true" aria-label="Welcome to Tropeamine Packs">
   <div className="casual-modal welcome-modal">
    <button className="casual-close" aria-label="Close welcome" onClick={markSeen}><X size={20}/></button>
    <p className="casual-eyebrow">WELCOME TO TROPEAMINE PACKS</p>
    <h1>Collect the characters that stick with you.</h1>
    <p className="casual-lede">No trading-card knowledge needed. The whole loop is three simple things.</p>
    <div className="casual-steps">
     <div><span><Droplets size={21}/></span><strong>1. Earn Ink</strong><small>Ink is the currency used to open packs.</small></div>
     <div><span><Layers size={21}/></span><strong>2. Open packs</strong><small>Each pack reveals 5 collectible character cards.</small></div>
     <div><span><Library size={21}/></span><strong>3. Fill your Binder</strong><small>Duplicates turn into Shards you can use on missing cards.</small></div>
    </div>
    {snapshot.ink>=100&&<div className="starter-note"><Droplets size={16}/><span>You already have <strong>{snapshot.ink} Ink</strong> — enough to open your first pack.</span></div>}
    <div className="casual-actions"><Link href="/packs" className="button gold" onClick={markSeen}>Open your first pack <Layers size={16}/></Link><button className="text-link" onClick={markSeen}>Look around first</button></div>
   </div>
  </div>}

  {help&&<div className="casual-overlay" role="dialog" aria-modal="true" aria-label="How Tropeamine Packs works">
   <div className="casual-modal help-modal">
    <button className="casual-close" aria-label="Close help" onClick={()=>setHelp(false)}><X size={20}/></button>
    <p className="casual-eyebrow">QUICK GUIDE</p><h2>How this works</h2>
    <div className="help-grid">
     <div><Droplets size={20}/><span><strong>Ink</strong><small>Spend 100 Ink to open a pack.</small></span></div>
     <div><Diamond size={20}/><span><strong>Shards</strong><small>Duplicates become Shards. Missing available cards cost 30 Shards to craft.</small></span></div>
     <div><Compass size={20}/><span><strong>Discover</strong><small>The full checklist — cards you own and cards you still need.</small></span></div>
     <div><Library size={20}/><span><strong>Binder</strong><small>Your personal collection and completion progress.</small></span></div>
     <div><Layers size={20}/><span><strong>Locked cards</strong><small>You have not collected them yet. Find them in packs or craft them when available.</small></span></div>
     <div><BookOpen size={20}/><span><strong>After Dark</strong><small>Optional adult editions. Off by default and separate from the normal collection.</small></span></div>
    </div>
    <div className="help-tip"><strong>New here?</strong> Start with a pack, then open your Binder. That is enough to understand almost everything else.</div>
    <button className="button gold" onClick={()=>setHelp(false)}>Got it</button>
   </div>
  </div>}

  {pathname==='/'&&!complete&&!hidden&&!welcome&&<aside className="starter-checklist" aria-label="Getting started checklist">
   <button className="starter-dismiss" aria-label="Hide getting started checklist" onClick={hideChecklist}><X size={15}/></button>
   <div className="starter-head"><span><strong>Getting started</strong><small>{done} of {checklist.length} complete</small></span><b>{snapshot.total?Math.round((snapshot.owned/snapshot.total)*100):0}%</b></div>
   <div className="starter-progress"><i style={{width:`${(done/checklist.length)*100}%`}}/></div>
   {checklist.map(item=><Link key={item.label} href={item.href} className={item.done?'starter-task done':'starter-task'}><span>{item.done?<Check size={13}/>:null}</span>{item.label}</Link>)}
   <small className="starter-collection">Collection: {snapshot.owned} / {snapshot.total||'—'} cards</small>
  </aside>}

  {!welcome&&<button className="how-it-works" onClick={()=>setHelp(true)}><HelpCircle size={17}/>How it works</button>}
 </>;
}
