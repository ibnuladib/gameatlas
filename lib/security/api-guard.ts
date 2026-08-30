import { NextRequest, NextResponse } from 'next/server';
import { isCookieHeaderSafe } from '@/lib/security/cookies';
import { applySecurityHeaders } from '@/lib/security/headers';

const DEFAULT_MAX_BODY_BYTES = 8_192;

function allowedOrigins(): Set<string> {
  const origins = new Set<string>(['http://localhost:3000', 'http://127.0.0.1:3000']);
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) origins.add(site.replace(/\/$/, ''));
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) origins.add(`https://${vercel.replace(/\/$/, '')}`);
  return origins;
}

/** Block cross-site POSTs in production when Origin/Referer is present. */
function isSameOrigin(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;

  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  if (origin) return allowedOrigins().has(origin);

  const referer = request.headers.get('referer');
  if (!referer) return true;
  try {
    const refOrigin = new URL(referer).origin;
    return allowedOrigins().has(refOrigin);
  } catch {
    return false;
  }
}

function forbiddenResponse(): NextResponse {
  const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  applySecurityHeaders(res.headers);
  return res;
}

function badRequestResponse(message: string): NextResponse {
  const res = NextResponse.json({ error: message }, { status: 400 });
  applySecurityHeaders(res.headers);
  return res;
}

export type GuardOptions = {
  maxBodyBytes?: number;
  requireJsonPost?: boolean;
};

export type GuardFailure = { ok: false; response: NextResponse };
export type GuardSuccess = { ok: true; body: unknown };

/** Shared checks for API Route Handlers: cookies, origin, body size. Rate limits run in middleware. */
export async function guardApiRequest(
  request: NextRequest,
  options: GuardOptions = {},
): Promise<GuardSuccess | GuardFailure> {
  if (!isCookieHeaderSafe(request.headers.get('cookie'))) {
    return { ok: false, response: badRequestResponse('Invalid request headers') };
  }

  if (request.method === 'POST' && !isSameOrigin(request)) {
    return { ok: false, response: forbiddenResponse() };
  }

  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
    return { ok: true, body: undefined };
  }

  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const rawLength = Number(request.headers.get('content-length') ?? 0);
  if (rawLength > maxBytes) {
    return { ok: false, response: badRequestResponse('Request body too large') };
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (options.requireJsonPost && !contentType.includes('application/json')) {
    return { ok: false, response: badRequestResponse('Expected application/json') };
  }

  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return { ok: false, response: badRequestResponse('Request body too large') };
    }
    if (!text.trim()) return { ok: true, body: {} };
    const body = JSON.parse(text) as unknown;
    return { ok: true, body };
  } catch {
    return { ok: false, response: badRequestResponse('Invalid JSON body') };
  }
}

/** Verify Vercel cron Authorization when CRON_SECRET is configured. */
export function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  applySecurityHeaders(res.headers);
  return res;
}
