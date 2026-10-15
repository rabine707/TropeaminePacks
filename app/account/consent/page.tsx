'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import AccountPolicyForm from '@/components/account-policy-form';
import {createClient} from '@/lib/supabase/client';
import {POLICY_VERSION} from '@/lib/account-policy';
import {safeNextPath} from '@/lib/auth-navigation';
export default function AccountConsent(){
 const [error,setError]=useState(''),[ageBand,setAgeBand]=useState<string|null>(null);
 useEffect(()=>{void fetch('/api/account').then(async response=>{const data=await response.json();if(!response.ok){setError(data.error);return;}setAgeBand(data.ageBand);if(data.ready)window.location.replace(safeNextPath(new URLSearchParams(location.search).get('next')));}).catch(()=>setError('Could not load your account. Please try again.'));},[]);
 return <main className="auth-page"><section className="auth-card"><p className="eyebrow">TROPEAMINE PACKS · BETA</p><h1>A little housekeeping.</h1><p>Your cards, balances, and rewards stay yours. Before continuing, please acknowledge the account policy.</p>{error&&<p role="alert" className="auth-error">{error}</p>}
  <AccountPolicyForm onAccepted={async band=>{const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'accept_policy',ageBand:ageBand||band,acceptTerms:true,version:POLICY_VERSION})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save policy acceptance.');window.location.replace(safeNextPath(new URLSearchParams(location.search).get('next')));}}/>
  <Link href="/account/privacy" className="text-link">Manage privacy or delete my account</Link><button className="auth-text-button" onClick={async()=>{await createClient().auth.signOut();window.location.href='/login';}}>Sign out</button>
 </section></main>;
}
