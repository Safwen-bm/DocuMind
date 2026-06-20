// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\middleware.ts

import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'

const intlMiddleware = createMiddleware(routing)

const protectedRoutes = ['/dashboard', '/workspace', '/invitations', '/profile', '/documents', '/pricing']
const authRoutes = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password']
// /share is intentionally PUBLIC — no token needed

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  const pathnameWithoutLocale = pathname.replace(/^\/(en|fr|ar)/, '') || '/'

  // /share/* — always public, skip all checks
  if (pathnameWithoutLocale.startsWith('/share')) {
    return intlMiddleware(request)
  }

  if (protectedRoutes.some(r => pathnameWithoutLocale.startsWith(r)) && !token) {
    const locale = pathname.split('/')[1] || 'en'
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
  }

  if (authRoutes.some(r => pathnameWithoutLocale.startsWith(r)) && token) {
    const locale = pathname.split('/')[1] || 'en'
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}