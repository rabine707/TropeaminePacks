'use client';
import {useState, type FormEvent} from 'react';
import Link from 'next/link';
import {CONTENT_NOTICE, POLICY_VERSION, SUPPORT_EMAIL, type AgeBand} from '@/lib/account-policy';

export default function AccountPolicyForm({onAccepted}: {onAccepted: (band: AgeBand) => Promise<void> | void}) {
 const [ageBand,setAgeBand]=useState(''), [accepted,setAccepted]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');
  try {
   const response=await fetch('/api/account/policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ageBand,acceptTerms:accepted,version:POLICY_VERSION})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Please review the account requirements.');
   await onAccepted(ageBand as AgeBand);
  }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <form className="auth-form account-policy-form" onSubmit={submit}>
  <p className="beta-content-notice">{CONTENT_NOTICE}</p>
  <label>Age range<select required value={ageBand} onChange={e=>setAgeBand(e.target.value)}><option value="">Choose your age range…</option><option value="under_13">Under 13</option><option value="13_17">13–17</option><option value="18_plus">18 or older</option></select></label>
  <p className="footnote">Accounts require age 13 or older. We store your declared age range and policy acceptance, not your full birthday or an identity document.</p>
  <label className="policy-checkbox"><input type="checkbox" required checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</span></label>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  <button className="button gold" disabled={busy}>{busy?'Checking…':'Continue'}</button>
  <small>Questions or an under-13 account concern? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></small>
 </form>;
}
