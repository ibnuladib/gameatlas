import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listMappedGames } from '@/lib/games/queries';
import { getServerSupabaseClient } from '@/lib/supabase/client';

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  genre: z.string().trim().max(40).optional(),
  tag: z.string().trim().max(40).optional(),
  yearMin: z.coerce.number().int().min(1980).max(2100).optional(),
  yearMax: z.coerce.number().int().min(1980).max(2100).optional(),
  maxPlaytimeHours: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: NextRequest) {
  const supabase = getServerSupabaseClient();
  if (!supabase) return NextResponse.json({ games: [], configured: false });
  const parsed = filtersSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ games: [], configured: true, error: 'Invalid filters' }, { status: 400 });
  }
  try {
    const games = await listMappedGames(supabase, parsed.data);
    return NextResponse.json({ games, configured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    return NextResponse.json({ games: [], configured: true, error: message }, { status: 500 });
  }
}
