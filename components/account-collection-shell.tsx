'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Cloud,Diamond,Droplets,LogOut,UserRound,Heart,Sparkles,Library,ShieldCheck} from 'lucide-react';import {usePathname} from 'next/navigation';
import type {User} from '@supabase/supabase-js';
import CollectionApp from '@/components/collection-app';
import {initialCards,initialRequests,type Card} from '@/lib/catalog';
import {createClient} from '@/lib/supabase/client';

const LOCAL_KEY='tropeamine-packs-v1';

type CloudProfile={display_name:string|null;username:string|null;avatar_url:string|null;bio?:string|null;pronouns?:string|null;favorite_series?:string|null;profile_public?:boolean};
type CloudWallet={ink:number;shards:number};type CloudProgress={favorites:string[];showcase:string[];badges:string[];claimed_rewards:string[];binder_theme:string;onboarding_complete:boolean;accent?:string;showcase_title?:string};

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
 const path=usePathname(); const [hydrated,setHydrated]=useState(false);
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<CloudProfile|null>(null); const [progress,setProgress]=useState<CloudProgress|null>(null);
 const [wallet,setWallet]=useState<CloudWallet|null>(null);
 const [syncing,setSyncing]=useState(false);
 const [syncError,setSyncError]=useState('');
 const [editingAccount,setEditingAccount]=useState(false);
 const [accountMessage,setAccountMessage]=useState(''); const [publicProfile,setPublicProfile]=useState<any>(null); const [publicLoading,setPublicLoading]=useState(false); const [catalog,setCatalog]=useState<Card[]>(initialCards);
 const lastOwnedRef=useRef(''); const lastProgressRef=useRef('');
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
  if(liveCardsResult.cards.length){local={...local,cards:liveCardsResult.cards};setCatalog(liveCardsResult.cards)}else setCatalog(local.cards||initialCards);

  if(!nextUser){
   try{localStorage.setItem(LOCAL_KEY,JSON.stringify(local))}catch{}
   setHydrated(true);
   return;
  }

  const [profileResult,walletResult,collectionResult,progressResult]=await Promise.all([
   client.from('profiles').select('display_name,username,avatar_url,bio,pronouns,favorite_series,profile_public').eq('id',nextUser.id).maybeSingle(),
   client.from('wallets').select('ink,shards').eq('user_id',nextUser.id).maybeSingle(),
   client.from('collection_items').select('card_id,quantity').eq('user_id',nextUser.id),   client.from('collector_progress').select('favorites,showcase,badges,claimed_rewards,binder_theme,onboarding_complete,accent,showcase_title').eq('user_id',nextUser.id).maybeSingle()
  ]);
  if(!active)return;
  if(profileResult.data)setProfile(profileResult.data as CloudProfile);  const cloudProgress=(progressResult.data||{favorites:[],showcase:[],badges:[],claimed_rewards:[],binder_theme:'Midnight',onboarding_complete:false}) as CloudProgress; setProgress(cloudProgress);
  const cloudWallet={ink:Number(walletResult.data?.ink??350),shards:Number(walletResult.data?.shards??20)};
  setWallet(cloudWallet);
  const cloudOwned=normalizedOwned((collectionResult.data||[]).map(row=>String(row.card_id)));
  const merged={...local,favorites:cloudProgress.favorites||[],claimed:cloudProgress.claimed_rewards||[],theme:cloudProgress.binder_theme||local.theme,wallet:{...local.wallet,...cloudWallet,owned:cloudOwned}};
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify(merged))}catch{}
  lastOwnedRef.current=JSON.stringify(cloudOwned); lastProgressRef.current=JSON.stringify({favorites:merged.favorites,claimed:merged.claimed,theme:merged.theme});
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

 useEffect(()=>{if(!hydrated||!user)return;let stopped=false;async function syncProgress(){try{const raw=localStorage.getItem(LOCAL_KEY);if(!raw)return;const s=JSON.parse(raw);const payload={favorites:Array.isArray(s.favorites)?s.favorites:[],claimed_rewards:Array.isArray(s.claimed)?s.claimed:[],binder_theme:String(s.theme||'Midnight'),updated_at:new Date().toISOString()};const sig=JSON.stringify({favorites:payload.favorites,claimed:payload.claimed_rewards,theme:payload.binder_theme});if(sig===lastProgressRef.current)return;const {error}=await client.from('collector_progress').upsert({user_id:user.id,...payload},{onConflict:'user_id'});if(error)throw error;if(!stopped)lastProgressRef.current=sig}catch{}}const timer=window.setInterval(()=>void syncProgress(),1500);void syncProgress();return()=>{stopped=true;window.clearInterval(timer)}},[client,hydrated,user]); useEffect(()=>{if(!hydrated||!path.startsWith('/collector/'))return;let active=true;setPublicLoading(true);const username=decodeURIComponent(path.split('/')[2]||'');client.rpc('public_collector_profile',{profile_username:username}).then(({data})=>{if(active)setPublicProfile(Array.isArray(data)?data[0]||null:data||null);setPublicLoading(false)});return()=>{active=false}},[client,hydrated,path]);
 const metaName=String(user?.user_metadata?.full_name||user?.user_metadata?.name||'').trim();
 const savedName=(profile?.display_name||'').trim();
 const accountName=(savedName&&savedName!=='Collector'?savedName:metaName)||savedName||user?.email?.split('@')[0]||'Reader';
 const avatar=profile?.avatar_url||String(user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'');
 const initials=accountName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'R';
 async function saveAccount(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!user)return;
  const f=new FormData(e.currentTarget),display_name=String(f.get('display_name')||'').trim(),username=String(f.get('username')||'').trim().toLowerCase(),bio=String(f.get('bio')||'').trim(),pronouns=String(f.get('pronouns')||'').trim(),favorite_series=String(f.get('favorite_series')||'').trim(),avatar_url=String(f.get('avatar_url')||'').trim(),profile_public=f.get('profile_public')==='on';
  if(!display_name){setAccountMessage('Add a display name.');return}
  if(!/^[a-z0-9_]{3,30}$/.test(username)){setAccountMessage('Username must be 3–30 letters, numbers, or underscores.');return}
  setAccountMessage('Saving…');
  const {data,error}=await client.from('profiles').update({display_name,username,bio,pronouns,favorite_series,avatar_url:avatar_url||null,profile_public,updated_at:new Date().toISOString()}).eq('id',user.id).select('display_name,username,avatar_url,bio,pronouns,favorite_series,profile_public').single();
  if(error){setAccountMessage(error.code==='23505'?'That username is already taken.':'Could not save account settings.');return}
  setProfile(data as CloudProfile);setAccountMessage('Saved');setEditingAccount(false);
 }
 async function uploadAvatar(file:File){if(!user)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setAccountMessage('Use a JPG, PNG, or WebP under 5 MB.');return}setAccountMessage('Uploading photo…');const ext=file.name.split('.').pop()?.toLowerCase()||'jpg',path=`${user.id}/avatar.${ext}`;const {error}=await client.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type});if(error){setAccountMessage('Could not upload photo.');return}const {data}=client.storage.from('profile-avatars').getPublicUrl(path);const url=`${data.publicUrl}?v=${Date.now()}`;const {data:saved,error:saveError}=await client.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',user.id).select('display_name,username,avatar_url,bio,pronouns,favorite_series,profile_public').single();if(saveError){setAccountMessage('Photo uploaded, but profile update failed.');return}setProfile(saved as CloudProfile);setAccountMessage('Profile photo updated.')}
 async function savePersonalization(theme:string,accent:string){if(!user)return;const {error}=await client.from('collector_progress').upsert({user_id:user.id,binder_theme:theme,accent,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error){setAccountMessage('Could not save personalization.');return}setProgress(p=>({...p!,binder_theme:theme}));try{const raw=localStorage.getItem(LOCAL_KEY);if(raw){const local=JSON.parse(raw);local.theme=theme;localStorage.setItem(LOCAL_KEY,JSON.stringify(local))}}catch{}setAccountMessage('Personalization saved.')}
 async function signOut(){await client.auth.signOut();window.location.href='/'}

 if(!hydrated)return <main className="empty"><p className="eyebrow">TROPEAMINE PACKS</p><h1>Opening your collection…</h1></main>;
 if(path.startsWith('/collector/')){if(publicLoading)return <main className="empty"><h1>Opening collector profile…</h1></main>;if(!publicProfile)return <main className="empty"><h1>Collector profile unavailable</h1><p>This profile is private or the username does not exist.</p><a className="button outline" href="/">Back home</a></main>;return <main className="account-page public-collector"><div className="account-hero"><div className="account-avatar">{publicProfile.avatar_url?<img src={publicProfile.avatar_url} alt="" referrerPolicy="no-referrer"/>:<span>{String(publicProfile.display_name||publicProfile.username).charAt(0)}</span>}</div><div><p className="eyebrow">PUBLIC COLLECTOR</p><h1>{publicProfile.display_name||publicProfile.username}</h1><p>@{publicProfile.username}{publicProfile.pronouns&&` · ${publicProfile.pronouns}`}</p></div></div><div className="account-columns"><section className="panel"><h2>About this collector</h2><p>{publicProfile.bio||'No bio yet.'}</p>{publicProfile.favorite_series&&<p><b>Favorite series:</b> {publicProfile.favorite_series}</p>}</section><section className="panel"><p className="eyebrow">SHOWCASE</p><h2>Display shelf</h2><div className="account-showcase-grid">{(publicProfile.showcase||[]).map((id:string)=>{const card=catalog.find(x=>x.id===id);return card?<div key={id}>{card.image?<img src={card.image} alt={card.name}/>:<span>{card.name.charAt(0)}</span>}<b>{card.name}</b><small>{card.series}</small></div>:null})}</div><p>{(publicProfile.badges||[]).length} collector badges · {publicProfile.binder_theme||'Midnight'} theme</p></section></div></main>}
 if(path==='/account'){
  if(!user)return <main className="empty"><UserRound size={34}/><h1>Your collector profile</h1><p>Sign in to customize your identity, showcase and collection preferences.</p><a className="button gold" href="/login?next=/account">Sign in with Google</a></main>;
  return <main className="account-page"><div className="account-hero"><div className="account-avatar">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}</div><div><p className="eyebrow">COLLECTOR PROFILE</p><h1>{accountName}</h1><p>@{profile?.username||'choose-a-username'} {profile?.pronouns&&` · ${profile.pronouns}`}</p></div><div className="account-stats"><span><Library/><b>{JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')?.wallet?.owned?.length||0}</b><small>Editions</small></span><span><Heart/><b>{progress?.favorites?.length||0}</b><small>Favorites</small></span><span><ShieldCheck/><b>{progress?.badges?.length||0}</b><small>Badges</small></span></div></div><div className="account-columns"><section className="panel"><p className="eyebrow">IDENTITY</p><h2>Profile details</h2><form className="form" onSubmit={saveAccount}><label>Display name<input name="display_name" defaultValue={accountName} maxLength={80} required/></label><label>Username<input name="username" defaultValue={profile?.username||''} minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" required/></label><label>Profile picture<div className="avatar-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadAvatar(f)}}/><small>JPG, PNG or WebP · max 5 MB</small></div><input name="avatar_url" type="url" defaultValue={profile?.avatar_url||''} placeholder="Or paste an image URL"/></label><label>Pronouns <span className="muted">(optional)</span><input name="pronouns" defaultValue={profile?.pronouns||''} maxLength={40}/></label><label>Bio<textarea name="bio" defaultValue={profile?.bio||''} maxLength={240} placeholder="A little about your bookshelf…"/></label><label>Favorite series<input name="favorite_series" defaultValue={profile?.favorite_series||''} maxLength={120}/></label><label className="account-toggle"><input type="checkbox" name="profile_public" defaultChecked={profile?.profile_public}/><span><b>Public collector profile</b><small>Allow your profile and showcase to be shared. Your email is never public.</small></span></label><button className="button gold">Save profile</button>{profile?.profile_public&&profile?.username&&<a className="button outline" href={`/collector/${profile.username}`}>View public profile</a>}{accountMessage&&<small>{accountMessage}</small>}</form></section><section><div className="panel"><p className="eyebrow">SHOWCASE</p><h2>Your display shelf</h2><p>Favorite cards become the foundation of your showcase. Pick the characters you want other collectors to see first.</p><div className="account-showcase-grid">{(progress?.showcase||[]).map(id=>{const card=catalog.find(x=>x.id===id);return card?<div key={id}>{card.image?<img src={card.image} alt={card.name}/>:<span>{card.name.charAt(0)}</span>}<b>{card.name}</b><small>{card.series}</small></div>:null})}{!(progress?.showcase?.length)&&<div className="showcase-placeholder"><span><Sparkles/>Your showcase is ready for its first cards</span></div>}</div><a className="button outline" href="/binder">Choose cards from binder</a></div><div className="panel account-personalize"><p className="eyebrow">PERSONALIZATION</p><h2>Make it yours</h2><label>Binder theme<select value={progress?.binder_theme||'Midnight'} onChange={e=>void savePersonalization(e.target.value,'Gold')}><option>Midnight</option><option>Rose</option><option>Forest</option></select></label><div><span>Accent</span><b>Gold</b></div><div><span>Favorite series</span><b>{profile?.favorite_series||'Not chosen'}</b></div></div><div className="panel"><p className="eyebrow">ACCOUNT</p><h2>Collection security</h2><p><Cloud size={16}/> Your binder and collector progression are synced to your account.</p><p className="muted">Signed in as {user.email}</p><button className="button outline" onClick={signOut}><LogOut size={15}/>Sign out</button></div></section></div></main>
 }
 return <div className={user?'cloud-authenticated':''}>
  <CollectionApp signedIn={Boolean(user)} cloudWallet={wallet||undefined} cloudShowcase={progress?.showcase||[]} onShowcase={async ids=>{if(!user)throw new Error('Sign in required');const {error}=await client.from('collector_progress').upsert({user_id:user.id,showcase:ids,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;setProgress(p=>({...p!,showcase:ids}))}} onClaimReward={async(key,ink,shards)=>{const {data,error}=await client.rpc('claim_collector_reward',{reward_key:key,ink_reward:ink,shard_reward:shards});if(error)throw error;const row=Array.isArray(data)?data[0]:data;const next={ink:Number(row.ink),shards:Number(row.shards)};setWallet(next);return next}} onSpendInk={async amount=>{if(!user)throw new Error('Sign in required');const {data,error}=await client.rpc('spend_ink',{amount});if(error)throw error;const next={ink:Number(data.ink),shards:Number(data.shards)};setWallet(next);return next}}/>
  {user&&<details className="cloud-account-menu">
   <summary aria-label="Open account menu">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}</summary>
   <div className="cloud-account-popover">
    <div className="cloud-account-head">{avatar?<img src={avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}<div><strong>{accountName}</strong><small>{user.email}</small></div></div>
    <div className="cloud-wallet"><span><Droplets size={15}/><strong>{wallet?.ink.toLocaleString()??'—'}</strong><small>Ink</small></span><span><Diamond size={15}/><strong>{wallet?.shards.toLocaleString()??'—'}</strong><small>Shards</small></span></div>
    <div className={syncError?'cloud-sync error':'cloud-sync'}>{syncError?<Cloud size={14}/>:<CheckCircle2 size={14}/>} {syncError|| (syncing?'Syncing binder…':'Binder synced to cloud')}</div>
    {profile?.username&&<small className="cloud-username">@{profile.username}</small>}
    {editingAccount?<form className="cloud-account-form" onSubmit={saveAccount}><label>Display name<input name="display_name" defaultValue={accountName} maxLength={80} required/></label><label>Username<input name="username" defaultValue={profile?.username||''} placeholder="your_username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" required/></label><small>Usernames are public-facing. Your Google email stays private.</small><div><button type="submit">Save settings</button><button type="button" onClick={()=>setEditingAccount(false)}>Cancel</button></div></form>:<a href="/account">Full profile & settings</a>}
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
