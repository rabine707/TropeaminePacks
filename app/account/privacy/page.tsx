'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {clearAccountStorage,SUPPORT_EMAIL} from '@/lib/account-policy';
type Status={ready:boolean;profilePublic:boolean;submissions:number;acceptedAt:string|null};
export default function AccountPrivacy(){
 const [status,setStatus]=useState<Status|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(false),[deleting,setDeleting]=useState(false),[confirmation,setConfirmation]=useState('');
 const load=useCallback(async()=>{try{const response=await fetch('/api/account');const result=await response.json();if(!response.ok)throw new Error(result.error);setStatus(result);}catch(e){setNotice(e instanceof Error?e.message:'Could not load account privacy.');}},[]);
 useEffect(()=>{void load();},[load]);
 async function action(body:Record<string,unknown>,url='/api/account'){
  setBusy(true);setNotice('');try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not complete the action.');
   if(result.deleted){try{clearAccountStorage(localStorage);clearAccountStorage(sessionStorage);}catch{}window.location.replace('/login?deleted=1');return;}
   setNotice('Saved.');setRemove(false);await load();
  }catch(e){setNotice(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <main className="account-privacy-page"><div className="account-privacy-wrap"><Link href="/binder" className="text-link">← Back to binder</Link><p className="eyebrow">YOUR ACCOUNT · YOUR CHOICES</p><h1>Privacy & account.</h1><p>Your collection should feel personal. Decide what stays public and what stays yours.</p>{notice&&<p className="panel" role="status">{notice}</p>}
  {!status&&<Link href="/login?next=/account/privacy" className="button outline">Sign in to manage your account</Link>}
  {status&&<>
   {!status.ready&&<p className="panel">Complete the <Link href="/account/consent">account policy</Link> to keep collecting. Privacy removal and account deletion remain available.</p>}
   <section className="panel"><h2>Profile visibility</h2><p>Profiles start private. A public profile may show your display name, username, avatar, bio, favorites, and showcase. It never includes your email or declared age range.</p><p><strong>Currently {status.profilePublic?'public':'private'}.</strong></p><button className="button outline" disabled={busy||!status.ready} onClick={()=>void action({action:'profile_visibility',public:!status.profilePublic})}>{status.profilePublic?'Make profile private':'Make profile public'}</button></section>
   <section className="panel"><h2>Community content</h2><p>You have {status.submissions} saved suggestions. Remove your submissions and notes, clear your account showcase, hide your profile, and remove your request/poll votes. Your binder, balances, and earned rewards stay intact.</p><p className="footnote">Independently contributed or creator-curated book/character requests may remain without your attribution. Copies downloaded or reposted elsewhere cannot be removed by Tropeamine.</p>
    {!remove?<button className="button outline" disabled={busy} onClick={()=>setRemove(true)}>Remove my community content</button>:<div><p>This removal cannot be undone. It does not delete your account.</p><div className="button-row"><button className="button outline" disabled={busy} onClick={()=>void action({action:'remove_content',confirmation:'REMOVE'})}>Confirm content removal</button><button className="button outline" disabled={busy} onClick={()=>setRemove(false)}>Cancel</button></div></div>}
   </section>
   <section className="panel"><h2>Delete account</h2><p>Permanently remove your login, profile, binder, balances, account rewards, votes, and private submissions. You must have signed in within the last 15 minutes. Catalog-upload owners must contact support for a safe ownership transfer first.</p><Link href="/login?next=/account/privacy&reauth=1" className="text-link">Sign in again before deleting →</Link>
    {!deleting?<button className="button outline account-delete-button" disabled={busy} onClick={()=>setDeleting(true)}>Delete my account</button>:<form onSubmit={e=>{e.preventDefault();void action({confirmation},'/api/account/delete');}}><label>Type DELETE to confirm<input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required pattern="DELETE"/></label><div className="button-row"><button className="button outline account-delete-button" disabled={busy||confirmation!=='DELETE'}>{busy?'Deleting…':'Permanently delete account'}</button><button type="button" className="button outline" disabled={busy} onClick={()=>{setDeleting(false);setConfirmation('');}}>Cancel</button></div></form>}
   </section>
  </>}
  <p>Need help with privacy, deletion, feedback, or artwork rights? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p><Link href="/privacy" className="text-link">Read the Privacy Policy</Link>
 </div></main>;
}
