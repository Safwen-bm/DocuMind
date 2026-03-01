import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

const protectedRoutes = ['/dashboard']
const authRoutes = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password']

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  // Strip locale prefix to check route type
  const pathnameWithoutLocale = pathname.replace(/^\/(en|fr|ar)/, '') || '/'

  // If protected route and no token → redirect to login
  if (protectedRoutes.some(r => pathnameWithoutLocale.startsWith(r)) && !token) {
    const locale = pathname.split('/')[1] || 'en'
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  // If auth route and has token → redirect to dashboard
  if (authRoutes.some(r => pathnameWithoutLocale.startsWith(r)) && token) {
    const locale = pathname.split('/')[1] || 'en'
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}