import { getServerSupabaseClient } from '@/lib/supabase/client';

/**
 * Vercel daily cron to keep a free Supabase project from pausing.
 *
 * Must stay dynamic: this route takes no arguments, so Next.js would otherwise
 * prerender it at build time and the cron would hit a cached response without
 * ever reaching the database — silently defeating the keep-alive.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return new Response('Supabase is not configured', { status: 503 });

  // maybeSingle: an empty catalog is still a successful ping, not an error.
  const { error } = await supabase.from('games').select('id').limit(1).maybeSingle();
  if (error) return new Response(`Keepalive query failed: ${error.message}`, { status: 500 });

  return new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
}
