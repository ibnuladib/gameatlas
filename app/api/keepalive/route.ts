import { supabase } from '@/lib/supabase/client';

/** Vercel daily cron to keep Supabase project warm */
export async function GET() {
  // simple cheap query to prevent DB idle timeout
  await supabase.from('games').select('id', { limit: 1 });
  return new Response('ok');
}
