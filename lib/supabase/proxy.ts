import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  const {data,error: claimsError} = await supabase.auth.getClaims()
  let signedIn = Boolean(data?.claims?.sub)
  if (claimsError) {
    // A claims-verification error must not silently skip policy checks for a valid account.
    const {data: {user}} = await supabase.auth.getUser()
    signedIn = Boolean(user)
  }
  const path = request.nextUrl.pathname
  const allowed = ['/login','/terms','/privacy','/data','/contact'].includes(path) ||
    path.startsWith('/account/') || path.startsWith('/auth/') || path.startsWith('/api/account') || path.startsWith('/api/auth/')
  if (signedIn && !allowed) {
    const {data: ready, error} = await supabase.rpc('account_policy_ready')
    if (error || ready !== true) {
      const target = request.nextUrl.clone()
      target.pathname = '/account/consent'
      target.search = ''
      target.searchParams.set('next', path + request.nextUrl.search)
      const redirect = NextResponse.redirect(target)
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
      redirect.headers.set('Cache-Control', 'private, no-store')
      return redirect
    }
  }
  return response
}
