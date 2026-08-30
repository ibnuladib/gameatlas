import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findSimilarGames, getGame } from '@/lib/games/queries';
import { getServerSupabaseClient } from '@/lib/supabase/client';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(_request: Request, context: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  try {
    const [game, similar] = await Promise.all([
      getGame(supabase, parsed.data.id),
      findSimilarGames(supabase, parsed.data.id, 8),
    ]);
    if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ game, similar });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
