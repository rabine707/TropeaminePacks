'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Cloud,Diamond,Droplets,LogOut} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import CollectionApp from '@/components/collection-app';
import {initialCards,initialRequests,type Card} from '@/lib/catalog';
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
function one<T>(value:T|T[]|null|undefined):T|null{return Array.isArray(value)?(value[0]??null):(value??null)}
function hueFor(value:string){const hues=['olive','wine','violet','blue','copper'];let hash=0;for(const ch of value)hash=(hash*31+ch.charCodeAt(0))>>>0;return hues[hash%hues.length]}
function rarityLabel(value:string):Card['rarity']{
 const normalized=value.toLowerCase();
 if(normalized==='legendary')return 'Legendary';
 if(normalized==='rare')return 'Rare';
 if(normalized==='uncommon')return 'Uncommon';
 return 'Common';
}

async function loadLiveCards(client:ReturnType<typeof createClient>):Promise<Card[]>{
 const {data,error}=await client.from('cards').select(`
  id,number,book_range,description,published,
  characters!inner(id,name,bio,lore,series!inner(id,title,author,published)),
  card_sets!inner(id,title,code,published),
  variants!inner(id,label,rarity,rating,premium,foil,available,card_assets(id,side,storage_path))
 `).eq('published',true).order('created_at',{ascending:true});
 if(error)throw error;
 const rows=(data??[]) as any[];
 const cards:Card[]=[];
 for(const row of rows){
  const character=one<any>(row.characters);
  const series=one<any>(character?.series);
  const set=one<any>(row.card_sets);
  const variants=(Array.isArray(row.variants)?row.variants:[]).filter((variant:any)=>variant?.rating==='sfw'&&variant?.available);
  const variant=variants[0];
  if(!character||!series||!set||!variant)continue;

  const assets=Array.isArray(variant.card_assets)?variant.card_assets:[];
  const paths:{front?:string;back?:string}={};
  for(const asset of assets){
   if(asset?.side==='front')paths.front=String(asset.storage_path||'');
   else if(asset?.side==='back')paths.back=String(asset.storage_path||'');
  }
  const signed:{front?:string;back?:string}={};
  await Promise.all((['front','back'] as const).map(async side=>{
   const path=paths[side];if(!path)return;
   const result=await client.storage.from('card-art').createSignedUrl(path,60*60*6);
   if(result.data?.signedUrl)signed[side]=result.data.signedUrl;
  }));

  const lore=(character.lore&&typeof character.lore==='object')?character.lore:{};
  const label=String(variant.label||'Standard');
  const variantLabel=label.toLowerCase()==='standard'?'Base edition':label;
  const mapped:Card={
   id:String(row.id),
   name:String(character.name||'Unnamed character'),
   number:row.number?`${String(set.code||'CARD')}-${String(row.number)}`:String(set.code||'CARD'),
   rarity:rarityLabel(String(variant.rarity||'common')),
   variant:variantLabel,
   hue:hueFor(String(character.name||row.id)),
   shelf:String(lore.shelf||'Shared Shelf'),
   genre:String(lore.genre||'Book Collection'),
   series:String(series.title||set.title||'Series'),
   author:String(series.author||''),
   tags:[String(row.book_range||''),String(set.code||'')].filter(Boolean),
   bio:String(row.description||character.bio||''),
   appearances:String(row.book_range||''),
   image:signed.front,
   back:signed.back,
   available:Boolean(variant.available),
   adult:false,
  };
  cards.push(mapped);
 }
 return cards;
}

export default function AccountCollectionShell(){
 const [hydrated,setHydrated]=useState(false);
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<CloudProfile|null>(null);
 const [wallet,setWallet]=useState<CloudWallet|null>(null);
 const [syncing,setSyncing]=useState(false);
 const [syncError,setSyncError]=useState('');
 const [editingAccount,setEditingAccount]=useState(false);
 const [accountMessage,setAccountMessage]=useState('');
 const lastOwnedRef=useRef('');
 const client=useMemo(()=>createClient(),[]);

 useEffect(()=>{let active=true;(async()=>{
  const [{data:{user:nextUser}},liveCardsResult]=await Promise.all([
   client.auth.getUser(),
   loadLiveCards(client).then(cards=>({cards,error:null as Error|null})).catch(error=>({cards:[] as Card[],error:error instanceof Error?error:new Error('Catalog unavailable')}))
  ]);
  if(!active)return;
  if(nextUser)setUser(nextUser);

  let local=starterState();
  try{const raw=localStorage.getItem(LOCAL_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.wallet&&Array.isArray(parsed.cards)&&Array.isArray(parsed.requests))local={...local,...parsed}}}catch{}
  if(liveCardsResult.cards.length)local={...local,cards:liveCardsResult.cards};

  if(!nextUser){
   try{localStorage.setItem(LOCAL_KEY,JSON.stringify(local))}catch{}
   setHydrated(true);
   return;
  }

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
  const merged={...local,wallet:{...local.wallet,...cloudWallet,owned:cloudOwned}};
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify(merged))}catch{}
  lastOwnedRef.current=JSON.stringify(cloudOwned);
  setHydrated(true);
 })();return()=>{active=false}},[client]);

 useEffect(()=>{if(!hydrated||!user)return;const activeUser=user;let stopped=false;async function syncCollection(){
  let owned:string[]=[];
  try{const raw=localStorage.getItem(LOCAL_KEY);if(!raw)return;const parsed=JSON.parse(raw);owned=normalizedOwned(Array.isArray(parsed?.wallet?.owned)?parsed.wallet.owned.map(String):[])}catch{return}
  const signature=JSON.stringify(owned);if(signature===lastOwnedRef.current)return;
  setSyncing(true);setSyncError('');
  try{
   const {data:rows,error}=await client.from('collection_items').select('card_id').eq('user_id',activeUser.id);if(error)throw error;
   const current=new Set((rows||[]).map(row=>String(row.card_id))),desired=new Set(owned);
   const add=[...desired].filter(id=>!current.has(id)),remove=[...current].filter(id=>!desired.has(id));
   if(add.length){const {error:insertError}=await client.from('collection_items').upsert(add.map(card_id=>({user_id:activeUser.id,card_id,quantity:1})),{onConflict:'user_id,card_id'});if(insertError)throw insertError}
   if(remove.length){const {error:deleteError}=await client.from('collection_items').delete().eq('user_id',activeUser.id).in('card_id',remove);if(deleteError)throw deleteError}
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
 async function saveAccount(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!user)return;
  const f=new FormData(e.currentTarget),display_name=String(f.get('display_name')||'').trim(),username=String(f.get('username')||'').trim().toLowerCase();
  if(!display_name){setAccountMessage('Add a display name.');return}
  if(!/^[a-z0-9_]{3,30}$/.test(username)){setAccountMessage('Username must be 3–30 letters, numbers, or underscores.');return}
  setAccountMessage('Saving…');
  const {data,error}=await client.from('profiles').update({display_name,username,updated_at:new Date().toISOString()}).eq('id',user.id).select('display_name,username,avatar_url').single();
  if(error){setAccountMessage(error.code==='23505'?'That username is already taken.':'Could not save account settings.');return}
  setProfile(data as CloudProfile);setAccountMessage('Saved');setEditingAccount(false);
 }
 async function signOut(){await client.auth.signOut();window.location.href='/'}

 if(!hydrated)return <main className="empty"><p className="eyebrow">TROPEAMINE PACKS</p><h1>Opening your collection…</h1></main>;
 return <div className={user?'cloud-authenticated':''}>
  <CollectionApp signedIn={Boolean(user)}/>
  {user&&<details className="cloud-account-menu">
   <summary aria-label="Open account menu">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}</summary>
   <div className="cloud-account-popover">
    <div className="cloud-account-head">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}<div><strong>{accountName}</strong><small>{user.email}</small></div></div>
    <div className="cloud-wallet"><span><Droplets size={15}/><strong>{wallet?.ink.toLocaleString()??'—'}</strong><small>Ink</small></span><span><Diamond size={15}/><strong>{wallet?.shards.toLocaleString()??'—'}</strong><small>Shards</small></span></div>
    <div className={syncError?'cloud-sync error':'cloud-sync'}>{syncError?<Cloud size={14}/>:<CheckCircle2 size={14}/>} {syncError|| (syncing?'Syncing binder…':'Binder synced to cloud')}</div>
    {profile?.username&&<small className="cloud-username">@{profile.username}</small>}
    {editingAccount?<form className="cloud-account-form" onSubmit={saveAccount}><label>Display name<input name="display_name" defaultValue={accountName} maxLength={80} required/></label><label>Username<input name="username" defaultValue={profile?.username||''} placeholder="your_username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" required/></label><small>Usernames are public-facing. Your Google email stays private.</small><div><button type="submit">Save settings</button><button type="button" onClick={()=>setEditingAccount(false)}>Cancel</button></div></form>:<button onClick={()=>{setEditingAccount(true);setAccountMessage('')}}>Account settings</button>}
    {accountMessage&&<small className="cloud-account-message">{accountMessage}</small>}
    <small className="cloud-wallet-note">Your Google email is private. Packs require an account so collection progress can stay tied to you.</small>
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
   .cloud-sync{display:flex;align-items:center;gap:6px;font-size:11px;color:#b9c69f;margin:8px 0}.cloud-sync svg{color:#d4c593}.cloud-sync.error{color:#d0a58d}.cloud-username{display:block;color:#d4c593;margin:-2px 0 8px}.cloud-account-form{display:grid;gap:9px;margin:10px 0;padding:11px;border:1px solid #30382c;border-radius:7px;background:#20251d}.cloud-account-form label{display:grid;gap:4px;font-size:10px;color:#9ba294}.cloud-account-form input{width:100%;box-sizing:border-box;border:1px solid #3b4333;border-radius:5px;background:#151914;color:#eeeede;padding:8px;font:inherit}.cloud-account-form>small,.cloud-account-message{color:#8e9785;font-size:10px;line-height:1.4}.cloud-account-form>div{display:flex;gap:14px}
   .cloud-wallet-note{display:block;color:#7f8877;line-height:1.45;margin:8px 0 12px}.cloud-account-popover button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#c6cdbd;padding:6px 0;font-size:12px}.cloud-account-popover button:hover{color:#d4c593}
   @media(max-width:600px){.cloud-account-menu{right:14px;top:15px}.cloud-account-menu>summary{width:29px;height:29px}.cloud-account-menu>summary img,.cloud-account-menu>summary span{width:29px;height:29px}.cloud-account-popover{right:0;top:39px;width:min(280px,calc(100vw - 28px))}.cloud-authenticated .balances{padding-right:35px}}
  `}</style>
 </div>;
}
