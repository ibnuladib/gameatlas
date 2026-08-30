import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findGamesByName } from '@/lib/games/queries';
import { parseDiscoveryQuery, templateAnswer } from '@/lib/nlp/parse';
import { recommendGames } from '@/lib/recommendations/engine';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { groqRephrase } from '@/lib/groq/groq';

const requestSchema = z.object({ question: z.string().trim().min(3).max(500) });

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ answer: 'Tell me a little more about what you want to play.' }, { status: 400 });
  }

  const slots = parseDiscoveryQuery(parsed.data.question);
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      answer: templateAnswer(parsed.data.question, slots, [], false),
      slots,
      games: [],
    });
  }

  try {
    const named = await findGamesByName(supabase, slots.similar_to);
    let seedIds = named.map((game) => game.id);
    if (seedIds.length === 0) {
      const { data } = await supabase.from('games').select('id').order('review_count', { ascending: false }).limit(8);
      seedIds = (data ?? []).map((row) => row.id);
    }

    // "shorter"/"longer" only means something relative to the games the user
    // named, so turn it into an hour bound using their actual playtime.
    let maxPlaytimeHours = slots.max_playtime_hours ?? undefined;
    let minPlaytimeHours: number | undefined;
    if (slots.relative_length && named.length) {
      const { data } = await supabase
        .from('games')
        .select('average_playtime')
        .in('id', named.map((game) => game.id))
        .not('average_playtime', 'is', null);
      const hours = (data ?? [])
        .map((row: { average_playtime: number | null }) => (row.average_playtime ?? 0) / 60)
        .filter((value) => value > 0);
      if (hours.length) {
        const reference = Math.round(Math.min(...hours));
        if (slots.relative_length === 'shorter') maxPlaytimeHours = Math.max(1, reference);
        else minPlaytimeHours = reference;
      }
    }

    const { games, relaxed } = await recommendGames(supabase, seedIds, {
      excludeGameIds: named.map((game) => game.id),
      maxPlaytimeHours,
      minPlaytimeHours,
      excludeGenres: slots.exclude_genres,
      genres: slots.genres.length ? slots.genres : undefined,
      mode: slots.mode,
      difficulty: slots.difficulty,
      limit: 8,
    });
    const fallback = templateAnswer(
      parsed.data.question,
      slots,
      games.map((game) => game.name),
      relaxed,
    );
    const answer = await groqRephrase(fallback, fallback);
    return NextResponse.json({ answer, slots, games, relaxed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json({
      answer: `I parsed your request but ranking failed (${message}). The catalog or similarity RPCs may not be set up yet.`,
      slots,
      games: [],
    });
  }
}

