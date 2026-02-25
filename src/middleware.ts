import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Note: NextAuth middleware is handled by authOptions and layout checks
// for simplicity in this App Router implementation.
export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
