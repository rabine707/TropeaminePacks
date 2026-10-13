import Link from 'next/link';
import UpdatePasswordForm from '@/components/update-password-form';
import {createClient} from '@/lib/supabase/server';

export const metadata={title:'Update password · Tropeamine Packs',robots:{index:false,follow:false}};

export default async function UpdatePasswordPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  return <main className="auth-page">{user?<UpdatePasswordForm/>:<section className="auth-card">
    <p className="eyebrow">TROPEAMINE PACKS</p>
    <h1>Request a fresh reset link.</h1>
    <p>This link has expired or your session is unavailable. Enter your email on the sign-in page, then choose “Forgot password?”.</p>
    <Link className="button gold" href="/login">Go to sign in</Link>
  </section>}</main>;
}
