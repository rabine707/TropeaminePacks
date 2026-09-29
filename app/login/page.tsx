'use client'

import Link from 'next/link'
import {FormEvent,useState} from 'react'
import {createClient} from '@/lib/supabase/client'

export default function LoginPage(){
 const [mode,setMode]=useState<'signin'|'signup'>('signin'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const next=()=>new URLSearchParams(window.location.search).get('next')||'/'
 async function google(){setBusy(true);setError('');const supabase=createClient();const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next())}`}});if(error){setError(error.message);setBusy(false)}}
 async function emailAuth(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setMessage('');const fd=new FormData(e.currentTarget),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');const supabase=createClient();
  if(mode==='signup'){const confirm=String(fd.get('confirm')||'');if(password!==confirm){setError('Passwords do not match.');setBusy(false);return}const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=${encodeURIComponent(next())}`}});if(error)setError(error.message);else if(data.session)window.location.href=next();else setMessage('Check your email to confirm your Tropeamine account, then sign in.')}
  else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);else window.location.href=next()}
  setBusy(false)
 }
 async function reset(){const email=(document.querySelector<HTMLInputElement>('input[name=email]')?.value||'').trim();if(!email){setError('Enter your email first.');return}setBusy(true);setError('');const supabase=createClient();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/account/update-password`});if(error)setError(error.message);else setMessage('If that email has an account, a password reset email is on the way.');setBusy(false)}
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">TROPEAMINE PACKS</p><h1>{mode==='signup'?'Create your collection.':'Welcome back.'}</h1><p>{mode==='signup'?'Create a Tropeamine account, or use Google.':'Sign in to sync your binder across devices.'}</p>
  <form className="auth-form" onSubmit={emailAuth}><label>Email<input type="email" name="email" autoComplete="email" required/></label><label>Password<input type="password" name="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={8} required/></label>{mode==='signup'&&<label>Confirm password<input type="password" name="confirm" autoComplete="new-password" minLength={8} required/></label>}<button className="button gold" disabled={busy}>{busy?'Working…':mode==='signup'?'Create account':'Sign in'}</button></form>
  {mode==='signin'&&<button className="auth-text-button" onClick={reset} disabled={busy}>Forgot password?</button>}
  <div className="auth-divider"><span>or</span></div><button className="button outline auth-google" onClick={google} disabled={busy}>Continue with Google</button>
  {error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-success">{message}</p>}
  <p className="auth-switch">{mode==='signup'?'Already have an account?':'New to Tropeamine?'} <button onClick={()=>{setMode(mode==='signup'?'signin':'signup');setError('');setMessage('')}}>{mode==='signup'?'Sign in':'Create account'}</button></p>
  {mode==='signup'&&<small className="auth-legal">By creating an account, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</small>}<Link className="text-link" href="/">Back to the collection</Link></section></main>
}