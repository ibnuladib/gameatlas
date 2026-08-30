import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from '@/lib/security/headers';
import { isCookieHeaderSafe } from '@/lib/security/cookies';
import {
  checkRateLimit,
  clientRateLimitKey,
  RATE_LIMITS,
} from '@/lib/security/rate-limit';

export function middleware(request: NextRequest) {
  if (!isCookieHeaderSafe(request.headers.get('cookie'))) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // Keepalive is auth-gated in the route handler, not rate-limited here.
    if (pathname !== '/api/keepalive') {
      const key = clientRateLimitKey(request.headers.get('x-forwarded-for'));
      const config =
        pathname === '/api/ask'
          ? RATE_LIMITS.ask
          : request.method === 'GET'
            ? RATE_LIMITS.read
            : RATE_LIMITS.write;
      const limited = checkRateLimit(`${pathname}:${key}`, config);
      if (!limited.ok) {
        const res = NextResponse.json(
          { error: 'Too many requests. Please wait and try again.' },
          { status: 429 },
        );
        res.headers.set('Retry-After', String(limited.retryAfterSec));
        applySecurityHeaders(res.headers);
        return res;
      }
    }
  }

  const response = NextResponse.next();
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
