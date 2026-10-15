import {createClient} from '@/lib/supabase/server';
import {cookies} from 'next/headers';
import {sameOrigin, validatePolicy, POLICY_VERSION, AGE_BLOCK_COOKIE} from '@/lib/account-policy';

export async function GET() {
  const client = await createClient();
  const {data: {user}, error: authError} = await client.auth.getUser();
  if (authError || !user) return Response.json({error: 'Sign in required.'}, {status: 401});
  const {data, error} = await client.rpc('account_policy_status');
  if (error) return Response.json({error: 'Account privacy features are awaiting the reviewed database setup.'}, {status: 503});
  return Response.json(data, {headers: {'Cache-Control': 'no-store'}});
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error: 'Request origin is not allowed.'}, {status: 403});
  if (Number(request.headers.get('content-length') || 0) > 2048) return Response.json({error: 'Request too large.'}, {status: 413});
  const client = await createClient();
  const {data: {user}, error: authError} = await client.auth.getUser();
  if (authError || !user) return Response.json({error: 'Sign in required.'}, {status: 401});
  try {
    const input = await request.json();
    let result;
    if (input.action === 'accept_policy') {
      if ((await cookies()).has(AGE_BLOCK_COOKIE)) return Response.json({error: 'Accounts are unavailable to people under 13. Contact support for help with an existing account.'}, {status: 403});
      const band = validatePolicy(input);
      result = await client.rpc('accept_account_policy', {declared_age_band: band, accepted_version: POLICY_VERSION});
    } else if (input.action === 'remove_content' && input.confirmation === 'REMOVE') {
      result = await client.rpc('remove_my_community_content');
    } else if (input.action === 'profile_visibility' && typeof input.public === 'boolean') {
      result = await client.rpc('set_my_profile_visibility', {make_public: input.public});
    } else return Response.json({error: 'Confirm the action before continuing.'}, {status: 400});
    if (result.error) return Response.json({error: 'The action could not be completed. Try again or contact support.'}, {status: 400});
    return Response.json({saved: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch { return Response.json({error: 'Please review the information and try again.'}, {status: 400}); }
}
