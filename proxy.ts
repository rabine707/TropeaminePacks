import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  // These static crawler endpoints must not depend on authentication services.
  if (request.nextUrl.pathname === '/robots.txt' || request.nextUrl.pathname === '/sitemap.xml') {
    return NextResponse.next();
  }
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!api/card-art/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
