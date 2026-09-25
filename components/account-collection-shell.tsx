'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Cloud,Diamond,Droplets,LogOut} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import CollectionApp from '@/components/collection-app';
import {initialCards,initialRequests} from '@/lib/catalog';
import {createClient} from '@/lib/supabase/client';

const LOCAL_KEY='tropeamine-packs-v1';

type CloudProfile={display_name:string|null;username:string|null;avatar_url:string|null};
type CloudWallet={ink:number;shards:number};

function starterState(){
 return {
  wallet:{ink:350,shards:20,owned:['war-1','war-2','war-3']},
  favorites:[],cards:initialCards,requests:initialRequests,votes:[],claimed:[],discovered:false,opened:0,reports:[],adultOptIn:false,theme:'Midnight',poll:'',questTitle:'Who should get the next foil edition?',featured:'Warlock'
 };
}

function normalizedOwned(ids:string[]){return [...new Set(ids)].sort()}

export default function AccountCollectionShell(){
 const [hydrated,setHydrated]=useState(false);
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<CloudProfile|null>(null);
 const [wallet,setWallet]=useState<CloudWallet|null>(null);
 const [syncing,setSyncing]=useState(false);
 const [syncError,setSyncError]=useState('');
 const lastOwnedRef=useRef('');
 const client=useMemo(()=>createClient(),[]);

 useEffect(()=>{let active=true;(async()=>{
  const {data:{user:nextUser}}=await client.auth.getUser();
  if(!active)return;
  if(!nextUser){setHydrated(true);return}
  setUser(nextUser);
  const [profileResult,walletResult,collectionResult]=await Promise.all([
   client.from('profiles').select('display_name,username,avatar_url').eq('id',nextUser.id).maybeSingle(),
   client.from('wallets').select('ink,shards').eq('user_id',nextUser.id).maybeSingle(),
   client.from('collection_items').select('card_id,quantity').eq('user_id',nextUser.id)
  ]);
  if(!active)return;
  if(profileResult.data)setProfile(profileResult.data as CloudProfile);
  const cloudWallet={ink:Number(walletResult.data?.ink??350),shards:Number(walletResult.data?.shards??20)};
  setWallet(cloudWallet);
  const cloudOwned=normalizedOwned((collectionResult.data||[]).map(row=>String(row.card_id)));
  let local=starterState();
  try{const raw=localStorage.getItem(LOCAL_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.wallet&&Array.isArray(parsed.cards)&&Array.isArray(parsed.requests))local={...local,...parsed}}}catch{}
  const merged={...local,wallet:{...local.wallet,...cloudWallet,owned:cloudOwned.length?cloudOwned:local.wallet.owned}};
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify(merged))}catch{}
  lastOwnedRef.current=cloudOwned.length?JSON.stringify(cloudOwned):'';
  setHydrated(true);
 })();return()=>{active=false}},[client]);

 useEffect(()=>{if(!hydrated||!user)return;let stopped=false;async function syncCollection(){
  let owned:string[]=[];
  try{const raw=localStorage.getItem(LOCAL_KEY);if(!raw)return;const parsed=JSON.parse(raw);owned=normalizedOwned(Array.isArray(parsed?.wallet?.owned)?parsed.wallet.owned.map(String):[])}catch{return}
  const signature=JSON.stringify(owned);if(signature===lastOwnedRef.current)return;
  setSyncing(true);setSyncError('');
  try{
   const {data:rows,error}=await client.from('collection_items').select('card_id').eq('user_id',user.id);if(error)throw error;
   const current=new Set((rows||[]).map(row=>String(row.card_id))),desired=new Set(owned);
   const add=[...desired].filter(id=>!current.has(id)),remove=[...current].filter(id=>!desired.has(id));
   if(add.length){const {error:insertError}=await client.from('collection_items').upsert(add.map(card_id=>({user_id:user.id,card_id,quantity:1})),{onConflict:'user_id,card_id'});if(insertError)throw insertError}
   if(remove.length){const {error:deleteError}=await client.from('collection_items').delete().eq('user_id',user.id).in('card_id',remove);if(deleteError)throw deleteError}
   if(!stopped)lastOwnedRef.current=signature;
  }catch{if(!stopped)setSyncError('Binder sync paused')}
  finally{if(!stopped)setSyncing(false)}
 }
 const timer=window.setInterval(()=>{void syncCollection()},1200);void syncCollection();return()=>{stopped=true;window.clearInterval(timer)}},[client,hydrated,user]);

 const metaName=String(user?.user_metadata?.full_name||user?.user_metadata?.name||'').trim();
 const savedName=(profile?.display_name||'').trim();
 const accountName=(savedName&&savedName!=='Collector'?savedName:metaName)||savedName||user?.email?.split('@')[0]||'Reader';
 const avatar=profile?.avatar_url||String(user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'');
 const initials=accountName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'R';
 async function signOut(){await client.auth.signOut();window.location.href='/'}

 if(!hydrated)return <main className="empty"><p className="eyebrow">TROPEAMINE PACKS</p><h1>Opening your collection…</h1></main>;
 return <div className={user?'cloud-authenticated':''}>
  <CollectionApp/>
  {user&&<details className="cloud-account-menu">
   <summary aria-label="Open account menu">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}</summary>
   <div className="cloud-account-popover">
    <div className="cloud-account-head">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}<div><strong>{accountName}</strong><small>{user.email}</small></div></div>
    <div className="cloud-wallet"><span><Droplets size={15}/><strong>{wallet?.ink.toLocaleString()??'—'}</strong><small>Ink</small></span><span><Diamond size={15}/><strong>{wallet?.shards.toLocaleString()??'—'}</strong><small>Shards</small></span></div>
    <div className={syncError?'cloud-sync error':'cloud-sync'}>{syncError?<Cloud size={14}/>:<CheckCircle2 size={14}/>} {syncError|| (syncing?'Syncing binder…':'Binder synced to cloud')}</div>
    <small className="cloud-wallet-note">Your cloud wallet is protected. Pack and quest currency changes are still preview-only until the economy moves server-side.</small>
    <button onClick={signOut}><LogOut size={15}/>Sign out</button>
   </div>
  </details>}
  <style jsx global>{`
   .cloud-authenticated .balances>a.text-link,.cloud-authenticated .balances>button.avatar.small{display:none!important}
   .cloud-account-menu{position:fixed;right:42px;top:22px;z-index:80}
   .cloud-account-menu>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%}
   .cloud-account-menu>summary::-webkit-details-marker{display:none}
   .cloud-account-menu>summary img,.cloud-account-menu>summary span,.cloud-account-head>img,.cloud-account-head>span{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #4a533d;background:#343b2b;display:flex;align-items:center;justify-content:center;color:#e7e7da;font-family:Georgia,serif;font-size:13px}
   .cloud-account-popover{position:absolute;right:0;top:45px;width:280px;padding:16px;background:#191d17;border:1px solid #3b4333;border-radius:9px;box-shadow:0 20px 55px #000a;color:#eeeede}
   .cloud-account-head{display:flex;align-items:center;gap:10px;padding-bottom:13px;border-bottom:1px solid #30362d}.cloud-account-head>div{min-width:0}.cloud-account-head strong{display:block;font-size:14px}.cloud-account-head small{display:block;color:#9ba294;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
   .cloud-wallet{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.cloud-wallet>span{display:grid;grid-template-columns:auto 1fr;column-gap:7px;align-items:center;padding:9px;border:1px solid #30382c;border-radius:6px;background:#20251d}.cloud-wallet svg{grid-row:1/3;color:#d4c593}.cloud-wallet strong{font-size:13px}.cloud-wallet small{font-size:10px;color:#8e9785}
   .cloud-sync{display:flex;align-items:center;gap:6px;font-size:11px;color:#b9c69f;margin:8px 0}.cloud-sync svg{color:#d4c593}.cloud-sync.error{color:#d0a58d}
   .cloud-wallet-note{display:block;color:#7f8877;line-height:1.45;margin:8px 0 12px}.cloud-account-popover button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#c6cdbd;padding:6px 0;font-size:12px}.cloud-account-popover button:hover{color:#d4c593}
   @media(max-width:600px){.cloud-account-menu{right:14px;top:15px}.cloud-account-menu>summary{width:29px;height:29px}.cloud-account-menu>summary img,.cloud-account-menu>summary span{width:29px;height:29px}.cloud-account-popover{right:0;top:39px;width:min(280px,calc(100vw - 28px))}.cloud-authenticated .balances{padding-right:35px}}
  `}</style>
 </div>;
}
