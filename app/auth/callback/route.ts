import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth-navigation'
import {cookies} from 'next/headers'
import {AGE_BLOCK_COOKIE, POLICY_COOKIE, POLICY_VERSION,publicRequestOrigin} from '@/lib/account-policy'
import {readPolicy} from '@/lib/account-policy-token'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const store = await cookies()
      const band = store.has(AGE_BLOCK_COOKIE) ? null : readPolicy(store.get(POLICY_COOKIE)?.value, process.env.ACCOUNT_POLICY_SIGNING_SECRET || '')
      const {data: status} = await supabase.rpc('account_policy_status')
      let ready = Boolean(status?.ready)
      if (!ready && band) {
        const {error: policyError} = await supabase.rpc('accept_account_policy', {declared_age_band: status?.ageBand || band, accepted_version: POLICY_VERSION})
        ready = !policyError
      }
      store.delete(POLICY_COOKIE)
      return NextResponse.redirect(new URL(ready || next === '/account/privacy' || next === '/account/update-password' ? next : `/account/consent?next=${encodeURIComponent(next)}`, publicRequestOrigin(request)))
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth', publicRequestOrigin(request)))
}
