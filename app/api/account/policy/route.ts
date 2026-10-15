import {cookies} from 'next/headers';
import {AGE_BLOCK_COOKIE, POLICY_COOKIE, POLICY_TTL_SECONDS, sameOrigin, validatePolicy, publicRequestOrigin} from '@/lib/account-policy';
import {signPolicy} from '@/lib/account-policy-token';
import {createClient} from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error: 'Request origin is not allowed.'}, {status: 403});
  if (Number(request.headers.get('content-length') || 0) > 2048) return Response.json({error: 'Request too large.'}, {status: 413});
  const store = await cookies();
  const options = {httpOnly: true, secure: publicRequestOrigin(request).startsWith('https:'), sameSite: 'lax' as const, path: '/'};
  try {
    const input = await request.json();
    if (store.has(AGE_BLOCK_COOKIE) || input.ageBand === 'under_13') {
      store.set(AGE_BLOCK_COOKIE, '1', {...options, maxAge: 86400});
      store.delete(POLICY_COOKIE);
      const client = await createClient();
      const {data: {user}} = await client.auth.getUser();
      if (user) {
        const {error} = await client.rpc('flag_my_under13_account');
        if (error) return Response.json({error: 'Your account needs privacy review. Please contact support; do not continue collecting.'}, {status: 503});
      }
      return Response.json({error: 'Accounts are not available to people under 13. Please do not submit personal information.'}, {status: 403});
    }
    const ageBand = validatePolicy(input);
    const secret = process.env.ACCOUNT_POLICY_SIGNING_SECRET || '';
    if (secret.length < 32) return Response.json({error: 'Beta signup is awaiting account-policy setup. Please contact support.'}, {status: 503});
    store.set(POLICY_COOKIE, signPolicy(ageBand, secret), {...options, maxAge: POLICY_TTL_SECONDS});
    return Response.json({eligible: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : 'Please review the account requirements.'}, {status: 400});
  }
}
