'use client';
import Link from 'next/link';
import {type FormEvent,useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {safeNextPath} from '@/lib/auth-navigation';
import AccountPolicyForm from '@/components/account-policy-form';
import {SUPPORT_EMAIL} from '@/lib/account-policy';

export default function LoginPage(){
 const [mode,setMode]=useState<'signin'|'signup'>('signin'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [prepared,setPrepared]=useState(false),[googlePending,setGooglePending]=useState(false);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('error')==='oauth')setError('Your sign-in link could not be completed. Try signing in again, or request a new reset email.');},[]);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('deleted')==='1')setMessage('Your account has been deleted.');},[]);
 const next=()=>safeNextPath(new URLSearchParams(window.location.search).get('next'));
 async function googleAfterPolicy(){setBusy(true);setError('');const {error}=await createClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next())}`,queryParams:{prompt:'select_account',max_age:'0'}}});if(error){setError(error.message);setBusy(false);}}
 async function google(){if(!prepared){setGooglePending(true);setError('');return;}await googleAfterPolicy();}
 async function emailAuth(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');setMessage('');const fields=new FormData(event.currentTarget),email=String(fields.get('email')||'').trim(),password=String(fields.get('password')||'');
  try{
   if(mode==='signup'){
    if(password!==String(fields.get('confirm')||''))throw new Error('Passwords do not match.');
    const response=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,next:next()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not create your account.');
    if(result.signedIn)window.location.href=next();else{setMessage(result.message);setPrepared(false);}
   }else{const {error}=await createClient().auth.signInWithPassword({email,password});if(error)throw error;window.location.href=next();}
  }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 async function reset(){const email=(document.querySelector<HTMLInputElement>('input[name=email]')?.value||'').trim();if(!email){setError('Enter your email first.');return;}setBusy(true);setError('');const {error}=await createClient().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth/callback?next=/account/update-password`});if(error)setError(error.message);else setMessage('If that email has an account, a password reset email is on the way.');setBusy(false);}
 const policyStep=(mode==='signup'&&!prepared)||googlePending;
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">TROPEAMINE PACKS · BETA</p><h1>{policyStep?'Before your collection.':mode==='signup'?'Create your collection.':'Welcome back.'}</h1><p>{policyStep?'A few clear boundaries for a good collecting experience.':mode==='signup'?'Create an account, or continue with Google.':'Sign in to sync your binder across devices.'}</p>
  {policyStep?<AccountPolicyForm onAccepted={async()=>{setPrepared(true);if(googlePending){setGooglePending(false);await googleAfterPolicy();}}}/>:<>
   <form className="auth-form" onSubmit={emailAuth}><label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required/></label><label>Password<input type="password" name="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={8} maxLength={128} required/></label>{mode==='signup'&&<label>Confirm password<input type="password" name="confirm" autoComplete="new-password" minLength={8} maxLength={128} required/></label>}<button className="button gold" disabled={busy}>{busy?'Working…':mode==='signup'?'Create account':'Sign in'}</button></form>
   {mode==='signin'&&<button className="auth-text-button" onClick={reset} disabled={busy}>Forgot password?</button>}<div className="auth-divider"><span>or</span></div><button className="button outline auth-google" onClick={()=>void google()} disabled={busy}>Continue with Google</button>
  </>}
  {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-success" role="status">{message}</p>}
  <p className="auth-switch">{mode==='signup'||googlePending?'Already have an account?':'New to Tropeamine?'} <button disabled={busy} onClick={()=>{setMode(mode==='signup'||googlePending?'signin':'signup');setGooglePending(false);setPrepared(false);setError('');setMessage('');}}>{mode==='signup'||googlePending?'Use email sign-in':'Create account'}</button></p>
  <small className="auth-legal">Google can create a new account, so its flow also checks the account policy. Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></small><Link className="text-link" href="/">Back to the collection</Link>
 </section></main>;
}
