'use client';

import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Diamond,Droplets,LogOut,Moon} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import CollectionApp from '@/components/collection-app';
import {initialCards,initialRequests,type Card} from '@/lib/catalog';
import {createClient} from '@/lib/supabase/client';
import {cardArtUrl} from '@/lib/card-art';

const LOCAL_KEY='tropeamine-packs-v1';

const LOADING_PRAISE=[
 'Look at you, waiting so patiently…',
 'So patient. You deserve a reward.',
 'That’s it. Just a little longer…',
 'Doing so well. Almost there…',
 'You’ve been so good. Your reward is loading…',
 'Patience looks good on you.',
 'There you go. You earned this.',
 'Someone deserves a little Tropeamine…',
 'Oh, you really want it, don’t you?',
 'Eager, aren’t we?'
];

type CloudProfile={
 display_name:string|null;
 username:string|null;
 avatar_url:string|null;
 adult_content_enabled:boolean;
 adult_age_confirmed_at:string|null;
};
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

function writeLocalAdultPreference(enabled:boolean){
 try{
  const raw=localStorage.getItem(LOCAL_KEY);
  const local=raw?JSON.parse(raw):starterState();
  localStorage.setItem(LOCAL_KEY,JSON.stringify({...local,adultOptIn:enabled}));
 }catch{}
}

async function loadLiveCards(client:ReturnType<typeof createClient>,allowAdult=false):Promise<Card[]>{
 const ratings=allowAdult?['sfw','adult']:['sfw'];
 const [{data,error},{data:membershipData,error:membershipError},{data:packData,error:packError}]=await Promise.all([
  client.from('cards').select(`
   id,number,book_range,description,published,
   characters!inner(id,name,bio,lore,series!inner(id,title,author,published)),
   card_sets!inner(id,title,code,published),
   variants!inner(id,label,rarity,rating,premium,foil,available,card_assets(id,side,storage_path))
  `).eq('published',true).in('variants.rating',ratings).eq('variants.available',true).order('created_at',{ascending:true}),
  client.from('card_pack_memberships').select('card_id,pack_id'),
  client.from('packs').select('id,slug').eq('active',true)
 ]);
 if(error)throw error;
 if(membershipError)throw membershipError;
 if(packError)throw packError;
 const rows=(data??[]) as any[];
 const packSlugs=new Map<string,string>((packData??[]).map(pack=>[String(pack.id),String(pack.slug)]));
 const memberships=new Map<string,string[]>();
 for(const membership of membershipData??[]){
  const cardId=String(membership.card_id),packSlug=packSlugs.get(String(membership.pack_id));
  if(!packSlug)continue;
  memberships.set(cardId,[...(memberships.get(cardId)??[]),packSlug]);
 }
 const cards:Card[]=[];
 for(const row of rows){
  const character=one<any>(row.characters);
  const series=one<any>(character?.series);
  const set=one<any>(row.card_sets);
  const variants=(Array.isArray(row.variants)?row.variants:[]).filter((variant:any)=>ratings.includes(String(variant?.rating))&&variant?.available);
  const variant=variants.find((item:any)=>item?.rating==='sfw')??variants[0];
  if(!character||!series||!set||!variant)continue;

  const rating=variant.rating==='adult'?'adult':'sfw';
  const assets=Array.isArray(variant.card_assets)?variant.card_assets:[];
  const artwork:{front?:string;back?:string}={};
  for(const asset of assets){
   if((asset?.side==='front'||asset?.side==='back')&&asset.id&&asset.storage_path?.startsWith(`${rating}/`)){
    artwork[asset.side as 'front'|'back']=cardArtUrl(String(asset.id),String(asset.storage_path));
   }
  }

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
   tags:[String(row.book_range||''),String(set.code||''),rating==='adult'?'Mature Content':''].filter(Boolean),
   bio:String(row.description||character.bio||''),
   appearances:String(row.book_range||''),
   image:artwork.front,
   back:artwork.back,
   packs:memberships.get(String(row.id))??[],
   available:Boolean(variant.available),
   adult:false,
  };
  cards.push(mapped);
 }
 return cards;
}

export default function AccountCollectionShell({isAdmin=false}:{isAdmin?:boolean}){
 const [hydrated,setHydrated]=useState(false);
 const [loadingPraise,setLoadingPraise]=useState(LOADING_PRAISE[0]);
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<CloudProfile|null>(null);
 const [identities,setIdentities]=useState<string[]>([]);
 const [wallet,setWallet]=useState<CloudWallet|null>(null);
 const [editingAccount,setEditingAccount]=useState(false);
 const [accountMessage,setAccountMessage]=useState('');
 const [matureBusy,setMatureBusy]=useState(false);
 const client=useMemo(()=>createClient(),[]);

 useEffect(()=>{setLoadingPraise(LOADING_PRAISE[Math.floor(Math.random()*LOADING_PRAISE.length)])},[]);
 useEffect(()=>{let active=true;(async()=>{
  const {data:{user:nextUser}}=await client.auth.getUser();
  if(!active)return;
  if(nextUser)setUser(nextUser);

  let local=starterState();
  try{const raw=localStorage.getItem(LOCAL_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.wallet&&Array.isArray(parsed.cards)&&Array.isArray(parsed.requests))local={...local,...parsed}}}catch{}

  if(!nextUser){
   const liveCardsResult=await loadLiveCards(client,false).then(cards=>({cards,error:null as Error|null})).catch(error=>({cards:[] as Card[],error:error instanceof Error?error:new Error('Catalog unavailable')}));
   if(liveCardsResult.cards.length)local={...local,cards:liveCardsResult.cards,adultOptIn:false};
   try{localStorage.setItem(LOCAL_KEY,JSON.stringify({...local,adultOptIn:false}))}catch{}
   setHydrated(true);
   return;
  }

  const [profileResult,walletResult,collectionResult]=await Promise.all([
   client.from('profiles').select('display_name,username,avatar_url,adult_content_enabled,adult_age_confirmed_at').eq('id',nextUser.id).maybeSingle(),
   client.from('wallets').select('ink,shards').eq('user_id',nextUser.id).maybeSingle(),
   client.from('collection_items').select('card_id,quantity').eq('user_id',nextUser.id)
  ]);
  if(!active)return;
  const cloudProfile=(profileResult.data??{display_name:null,username:null,avatar_url:null,adult_content_enabled:false,adult_age_confirmed_at:null}) as CloudProfile;
  setProfile(cloudProfile);
  const allowAdult=Boolean(cloudProfile.adult_content_enabled&&cloudProfile.adult_age_confirmed_at);
  const liveCardsResult=await loadLiveCards(client,allowAdult).then(cards=>({cards,error:null as Error|null})).catch(error=>({cards:[] as Card[],error:error instanceof Error?error:new Error('Catalog unavailable')}));
  if(!active)return;
  if(liveCardsResult.cards.length)local={...local,cards:liveCardsResult.cards};
  const identityResult=await client.auth.getUserIdentities();
  if(identityResult.data?.identities)setIdentities(identityResult.data.identities.map(identity=>identity.provider));
  const cloudWallet={ink:Number(walletResult.data?.ink??350),shards:Number(walletResult.data?.shards??20)};
  setWallet(cloudWallet);
  const cloudOwned=normalizedOwned((collectionResult.data||[]).map(row=>String(row.card_id)));
  const merged={...local,adultOptIn:allowAdult,wallet:{...local.wallet,...cloudWallet,owned:cloudOwned}};
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify(merged))}catch{}
  setHydrated(true);
 })();return()=>{active=false}},[client]);

 const metaName=String(user?.user_metadata?.full_name||user?.user_metadata?.name||'').trim();
 const savedName=(profile?.display_name||'').trim();
 const accountName=(savedName&&savedName!=='Collector'?savedName:metaName)||savedName||user?.email?.split('@')[0]||'Reader';
 const avatar=profile?.avatar_url||String(user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'');
 const initials=accountName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'R';
 const matureEnabled=Boolean(profile?.adult_content_enabled&&profile?.adult_age_confirmed_at);

 async function saveAccount(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!user)return;
  const f=new FormData(e.currentTarget),display_name=String(f.get('display_name')||'').trim(),username=String(f.get('username')||'').trim().toLowerCase();
  if(!display_name){setAccountMessage('Add a display name.');return}
  if(!/^[a-z0-9_]{3,30}$/.test(username)){setAccountMessage('Username must be 3–30 letters, numbers, or underscores.');return}
  setAccountMessage('Saving…');
  const {data,error}=await client.from('profiles').update({display_name,username,updated_at:new Date().toISOString()}).eq('id',user.id).select('display_name,username,avatar_url,adult_content_enabled,adult_age_confirmed_at').single();
  if(error){setAccountMessage(error.code==='23505'?'That username is already taken.':'Could not save account settings.');return}
  setProfile(data as CloudProfile);setAccountMessage('Saved');setEditingAccount(false);
 }

 async function setMatureContent(enabled:boolean){
  if(!user||matureBusy)return;
  if(enabled&&!profile?.adult_age_confirmed_at){
   const confirmed=window.confirm('Mature Content (18+) may include nudity, sexual themes, and other adult material. By enabling this setting, you confirm that you are 18 years of age or older.');
   if(!confirmed)return;
  }
  setMatureBusy(true);setAccountMessage('Saving content preference…');
  const confirmedAt=enabled?(profile?.adult_age_confirmed_at||new Date().toISOString()):profile?.adult_age_confirmed_at??null;
  const {data,error}=await client.from('profiles').update({adult_content_enabled:enabled,adult_age_confirmed_at:confirmedAt,updated_at:new Date().toISOString()}).eq('id',user.id).select('display_name,username,avatar_url,adult_content_enabled,adult_age_confirmed_at').single();
  if(error){setAccountMessage('Could not save Mature Content preference.');setMatureBusy(false);return}
  setProfile(data as CloudProfile);
  writeLocalAdultPreference(enabled);
  setAccountMessage(enabled?'Mature Content enabled for this account.':'Mature Content disabled.');
  setMatureBusy(false);
  window.location.reload();
 }

 async function linkGoogle(){setAccountMessage('Opening Google…');const {error}=await client.auth.linkIdentity({provider:'google',options:{redirectTo:window.location.href}});if(error)setAccountMessage(error.message)}
 async function signOut(){writeLocalAdultPreference(false);await client.auth.signOut();window.location.href='/'}

 if(!hydrated)return <main className="empty"><p className="eyebrow">TROPEAMINE PACKS</p><h1>{loadingPraise}</h1></main>;
 return <div className={`${user?'cloud-authenticated':''} ${isAdmin?'creator-admin':'creator-reader'}`}>
  <CollectionApp signedIn={Boolean(user)} cloudWallet={wallet||undefined} onCraftCard={async cardId=>{if(!user)throw new Error('Sign in required');const {data,error}=await client.rpc('craft_missing_card',{target_card_id:cardId});if(error)throw error;const row=Array.isArray(data)?data[0]:data;const next={ink:Number(row?.ink??0),shards:Number(row?.shards??0)};setWallet(next);return next}} onOpenPack={async packSlug=>{if(!user)throw new Error('Sign in required');const {data,error}=await client.rpc('open_pack_v2',{pack_slug:packSlug});if(error)throw error;const row=Array.isArray(data)?data[0]:data;const pulls=(Array.isArray(row?.pulls)?row.pulls:[]).map((pull:any)=>({id:String(pull?.id??''),duplicate:Boolean(pull?.duplicate),foil:Boolean(pull?.foil)})).filter((pull:{id:string})=>pull.id);if(pulls.length!==4||!pulls[3]?.foil)throw new Error('Pack settlement returned an invalid result.');const next={ink:Number(row?.ink??0),shards:Number(row?.shards??0),pulls};setWallet({ink:next.ink,shards:next.shards});return next}} onCraftTreatment={async(cardId,treatment,cost)=>{if(!user)throw new Error('Sign in required');const {data,error}=await client.rpc('craft_card_treatment',{target_card_id:cardId,treatment_id:treatment,shard_cost:cost});if(error)throw error;const row=Array.isArray(data)?data[0]:data;const next={ink:Number(row?.ink??0),shards:Number(row?.shards??0)};setWallet(next);return next}}/>
  {user&&<details className="cloud-account-menu">
   <summary aria-label="Open account menu">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}</summary>
   <div className="cloud-account-popover">
    <div className="cloud-account-head">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}<div><strong>{accountName}</strong><small>{user.email}</small></div></div>
    <div className="cloud-wallet"><span><Droplets size={15}/><strong>{wallet?.ink.toLocaleString()??'—'}</strong><small>Ink</small></span><span><Diamond size={15}/><strong>{wallet?.shards.toLocaleString()??'—'}</strong><small>Shards</small></span></div>
    <div className="cloud-sync"><CheckCircle2 size={14}/> Binder synced to cloud</div>
    {profile?.username&&<small className="cloud-username">@{profile.username}</small>}
    <div className="cloud-mature-setting">
     <div><Moon size={15}/><span><strong>Mature Content (18+)</strong><small>Show adult-themed card editions on this account.</small></span></div>
     <button type="button" className={matureEnabled?'is-on':''} disabled={matureBusy} onClick={()=>void setMatureContent(!matureEnabled)} aria-pressed={matureEnabled}>{matureEnabled?'ON':'OFF'}</button>
    </div>
    {profile?.adult_age_confirmed_at&&<small className="cloud-mature-note">Age confirmation saved to this account. You can turn Mature Content off at any time.</small>}
    {editingAccount?<form className="cloud-account-form" onSubmit={saveAccount}><label>Display name<input name="display_name" defaultValue={accountName} maxLength={80} required/></label><label>Username<input name="username" defaultValue={profile?.username||''} placeholder="your_username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" required/></label><small>Usernames are public-facing. Your Google email stays private.</small><div><button type="submit">Save settings</button><button type="button" onClick={()=>setEditingAccount(false)}>Cancel</button></div></form>:<button onClick={()=>{setEditingAccount(true);setAccountMessage('')}}>Account settings</button>}
    {accountMessage&&<small className="cloud-account-message">{accountMessage}</small>}<div className="cloud-identities"><small>SIGN-IN METHODS</small><span><CheckCircle2 size={13}/> Email {user.email?'connected':'unavailable'}</span><span>{identities.includes('google')?<><CheckCircle2 size={13}/> Google linked</>:<button type="button" onClick={linkGoogle}>Link Google account</button>}</span></div>
    <small className="cloud-wallet-note">Your email is private. Linked sign-in methods access the same Tropeamine collection.</small>
    <button onClick={signOut}><LogOut size={15}/>Sign out</button>
   </div>
  </details>}
  <style jsx global>{`
   .cloud-authenticated .balances>a.text-link,.cloud-authenticated .balances>button.avatar.small{display:none!important}\n   .creator-reader a[href="/admin"]{display:none!important}
   .cloud-account-menu{position:fixed;right:42px;top:22px;z-index:80}
   .cloud-account-menu>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%}
   .cloud-account-menu>summary::-webkit-details-marker{display:none}
   .cloud-account-menu>summary img,.cloud-account-menu>summary span,.cloud-account-head>img,.cloud-account-head>span{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #70405e;background:#351326;display:flex;align-items:center;justify-content:center;color:#f7eff4;font-family:Georgia,serif;font-size:13px}
   .cloud-account-popover{position:absolute;right:0;top:45px;width:300px;padding:16px;background:#100c12;border:1px solid #493044;border-radius:9px;box-shadow:0 20px 55px #000a;color:#f7eff4}
   .cloud-account-head{display:flex;align-items:center;gap:10px;padding-bottom:13px;border-bottom:1px solid #3a2534}.cloud-account-head>div{min-width:0}.cloud-account-head strong{display:block;font-size:14px}.cloud-account-head small{display:block;color:#b8a9b3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
   .cloud-wallet{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.cloud-wallet>span{display:grid;grid-template-columns:auto 1fr;column-gap:7px;align-items:center;padding:9px;border:1px solid #493044;border-radius:6px;background:#160d15}.cloud-wallet svg{grid-row:1/3;color:#ef82bc}.cloud-wallet strong{font-size:13px}.cloud-wallet small{font-size:10px;color:#a68e9e}
   .cloud-sync{display:flex;align-items:center;gap:6px;font-size:11px;color:#e6b2cf;margin:8px 0}.cloud-sync svg{color:#ef82bc}.cloud-username{display:block;color:#ef82bc;margin:-2px 0 8px}
   .cloud-mature-setting{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 4px;padding:10px;border:1px solid #493044;border-radius:7px;background:#160d15}.cloud-mature-setting>div{display:flex;align-items:flex-start;gap:8px;min-width:0}.cloud-mature-setting svg{color:#ef82bc;flex:none;margin-top:1px}.cloud-mature-setting span{width:auto!important;height:auto!important;border:0!important;background:transparent!important;display:block!important;font-family:inherit!important}.cloud-mature-setting strong{display:block;font-size:11px}.cloud-mature-setting small{display:block;color:#a68e9e;font-size:9px;line-height:1.35;margin-top:2px}.cloud-mature-setting button{flex:none!important;border:1px solid #5f4054!important;border-radius:999px!important;background:#22131e!important;padding:5px 9px!important;font-size:10px!important;font-weight:700!important}.cloud-mature-setting button.is-on{background:#6b244b!important;border-color:#b75586!important;color:#fff!important}.cloud-mature-setting button:disabled{opacity:.55}.cloud-mature-note{display:block;color:#a68e9e;font-size:9px;line-height:1.4;margin:4px 0 10px}
   .cloud-account-form{display:grid;gap:9px;margin:10px 0;padding:11px;border:1px solid #493044;border-radius:7px;background:#160d15}.cloud-account-form label{display:grid;gap:4px;font-size:10px;color:#b8a9b3}.cloud-account-form input{width:100%;box-sizing:border-box;border:1px solid #493044;border-radius:5px;background:#0b090d;color:#f7eff4;padding:8px;font:inherit}.cloud-account-form>small,.cloud-account-message{color:#a68e9e;font-size:10px;line-height:1.4}.cloud-account-form>div{display:flex;gap:14px}
   .cloud-wallet-note{display:block;color:#907d89;line-height:1.45;margin:8px 0 12px}.cloud-account-popover button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#e2d4dd;padding:6px 0;font-size:12px}.cloud-account-popover button:hover{color:#ef82bc}
   @media(max-width:600px){.cloud-account-menu{right:14px;top:15px}.cloud-account-menu>summary{width:29px;height:29px}.cloud-account-menu>summary img,.cloud-account-menu>summary span{width:29px;height:29px}.cloud-account-popover{right:0;top:39px;width:min(300px,calc(100vw - 28px))}.cloud-authenticated .balances{padding-right:35px}}
  `}</style>
 </div>;
}
