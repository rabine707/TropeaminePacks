'use client';

import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {createClient} from '@/lib/supabase/client';

export default function UpdatePasswordForm() {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [complete,setComplete]=useState(false);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget;
    const values=new FormData(form);
    const password=String(values.get('password')||'');
    if(password!==String(values.get('confirm')||'')){setError('Passwords do not match.');return;}
    if(password.length<8){setError('Use at least 8 characters.');return;}
    setBusy(true);setError('');
    try {
      const {error:authError}=await createClient().auth.updateUser({password});
      if(authError)throw authError;
      form.reset();setComplete(true);
    } catch(reason) {setError(reason instanceof Error?reason.message:'Your password could not be updated. Try again.');}
    finally {setBusy(false);}
  }

  return <section className="auth-card">
    <p className="eyebrow">TROPEAMINE PACKS</p>
    <h1>{complete?'You are all set.':'Choose a new password.'}</h1>
    {complete?<><p role="status">Your password has been updated.</p><Link className="button gold" href="/binder">Return to your binder</Link></>:<>
      <p>Use at least 8 characters to secure your collection.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>New password<input type="password" name="password" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
        <label>Confirm password<input type="password" name="confirm" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="button gold" disabled={busy}>{busy?'Updating…':'Update password'}</button>
      </form>
    </>}
    <Link className="text-link" href="/">Back to the collection</Link>
  </section>;
}
