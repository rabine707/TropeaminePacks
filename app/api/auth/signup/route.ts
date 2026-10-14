import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {AGE_BLOCK_COOKIE, POLICY_COOKIE, POLICY_VERSION, sameOrigin, publicRequestOrigin} from '@/lib/account-policy';
import {readPolicy} from '@/lib/account-policy-token';
import {safeNextPath} from '@/lib/auth-navigation';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error: 'Request origin is not allowed.'}, {status: 403});
  if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({error: 'Request too large.'}, {status: 413});
  const store = await cookies();
  const ageBand = readPolicy(store.get(POLICY_COOKIE)?.value, process.env.ACCOUNT_POLICY_SIGNING_SECRET || '');
  if (store.has(AGE_BLOCK_COOKIE) || !ageBand) return Response.json({error: 'Please complete the age and Terms step before creating an account.'}, {status: 403});
  try {
    const input = await request.json();
    if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 ||
      typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
      return Response.json({error: 'Enter a valid email and a password of 8–128 characters.'}, {status: 400});
    }
    const client = await createClient();
    // The reviewed Auth trigger validates this declaration and records it outside editable metadata.
    const {data, error} = await client.auth.signUp({email: input.email.trim(), password: input.password, options: {
      data: {tp_age_band: ageBand, tp_policy_version: POLICY_VERSION, tp_terms_accepted: true},
      emailRedirectTo: `${publicRequestOrigin(request)}/auth/callback?next=${encodeURIComponent(safeNextPath(input.next))}`,
    }});
    if (error) return Response.json({error: 'Could not create your account. Check your details or contact support.'}, {status: 400});
    store.delete(POLICY_COOKIE);
    return Response.json({signedIn: Boolean(data.session), message: 'Check your email to confirm your account, then sign in.'}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return Response.json({error: 'Could not create your account. Please try again.'}, {status: 400});
  }
}
