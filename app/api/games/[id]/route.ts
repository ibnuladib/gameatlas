import { z } from 'zod';
import { findSimilarGames, getGame } from '@/lib/games/queries';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { jsonResponse } from '@/lib/security/api-guard';
import { sanitizeErrorMessage } from '@/lib/security/sanitize';

const paramsSchema = z.object({ id: z.coerce.number().int().positive().max(2_000_000_000) });

export async function GET(_request: Request, context: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) return jsonResponse({ error: 'Invalid id' }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return jsonResponse({ error: 'Supabase is not configured' }, { status: 503 });

  try {
    const [game, similar] = await Promise.all([
      getGame(supabase, parsed.data.id),
      findSimilarGames(supabase, parsed.data.id, 8),
    ]);
    if (!game) return jsonResponse({ error: 'Not found' }, { status: 404 });
    return jsonResponse({ game, similar });
  } catch (error) {
    return jsonResponse({ error: sanitizeErrorMessage(error, 'Query failed') }, { status: 500 });
  }
}
