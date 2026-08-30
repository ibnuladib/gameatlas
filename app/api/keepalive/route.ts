import { NextRequest } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { verifyCronAuth } from '@/lib/security/api-guard';
import { applySecurityHeaders } from '@/lib/security/headers';

/**
 * Vercel daily cron to keep a free Supabase project from pausing.
 *
 * Must stay dynamic: this route takes no arguments, so Next.js would otherwise
 * prerender it at build time and the cron would hit a cached response without
 * ever reaching the database — silently defeating the keep-alive.
 *
 * Set CRON_SECRET in Vercel; the platform sends `Authorization: Bearer <secret>`.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) return new Response('Supabase is not configured', { status: 503 });

  const { error } = await supabase.from('games').select('id').limit(1).maybeSingle();
  if (error) return new Response('Keepalive failed', { status: 500 });

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  applySecurityHeaders(headers);
  return new Response('ok', { headers });
}
