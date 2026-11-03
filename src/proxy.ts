import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { GUEST_COOKIE, SESSION_COOKIE } from '@constants/auth'
import { PROTECTED_PREFIXES, RETURN_TO_QUERY, ROUTES } from '@constants/routes'

/**
 * Optimistic guard for the signed-in pages: it checks only that a session cookie is
 * *present* (the JWT secret belongs to the API). Real enforcement is the API's `requireAuth`;
 * this exists so a signed-out visitor lands on sign-in instead of an empty dashboard.
 * A guest who bought without an account may open the dashboard too: the guest cookie is
 * what lists their CVs there.
 *
 * The cookie is minted by the API host; in production it carries `Domain=<web host>` so it
 * is visible here too (`server/src/config.ts` → `cookieDomain`).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (!isProtected || request.cookies.has(SESSION_COOKIE)) return NextResponse.next()
  if (pathname === ROUTES.dashboard && request.cookies.has(GUEST_COOKIE)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = ROUTES.signIn
  url.search = ''
  url.searchParams.set(RETURN_TO_QUERY, `${pathname}${search}`)
  return NextResponse.redirect(url, 307)
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*'],
}
