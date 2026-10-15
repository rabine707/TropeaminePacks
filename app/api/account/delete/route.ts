import {cookies} from 'next/headers';
import {createClient as createAdminClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {deleteAccount} from '@/lib/account-deletion';
import {POLICY_COOKIE} from '@/lib/account-policy';

export async function POST(request: Request) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return Response.json({error: 'Account deletion is awaiting server setup. Please contact support.'}, {status: 503});
  const client = await createClient();
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {auth: {persistSession: false, autoRefreshToken: false}});
  return deleteAccount(request, {
    verifiedAccount: async () => {
      const {data: {user}, error} = await client.auth.getUser();
      if (error || !user) return null;
      const [{data: session}, {data: verified, error: claimsError}] = await Promise.all([client.auth.getSession(), client.auth.getClaims()]);
      if (claimsError || !session.session || !verified?.claims || verified.claims.sub !== user.id) return null;
      return {id: user.id, accessToken: session.session.access_token, claims: verified.claims};
    },
    preflight: async () => client.rpc('account_deletion_preflight'),
    revokeSessions: accessToken => admin.auth.admin.signOut(accessToken, 'global'),
    deleteUser: id => admin.auth.admin.deleteUser(id),
    clearCookies: async () => {
      const store = await cookies();
      for (const cookie of store.getAll()) if (/^sb-.*-auth-token/.test(cookie.name) || cookie.name === POLICY_COOKIE) store.delete(cookie.name);
    },
  });
}
