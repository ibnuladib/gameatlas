import { NextRequest } from 'next/server';
import { z } from 'zod';
import { findGamesByName } from '@/lib/games/queries';
import { parseDiscoveryQuery, templateAnswer } from '@/lib/nlp/parse';
import { recommendGames } from '@/lib/recommendations/engine';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { groqRephrase } from '@/lib/groq/groq';
import { guardApiRequest, jsonResponse } from '@/lib/security/api-guard';
import {
  looksLikePromptInjection,
  sanitizeErrorMessage,
  sanitizeUserText,
  stripPromptInjection,
} from '@/lib/security/sanitize';

const requestSchema = z.object({ question: z.string().trim().min(3).max(500) });

export async function POST(request: NextRequest) {
  const guard = await guardApiRequest(request, { requireJsonPost: true });
  if (!guard.ok) return guard.response;

  const parsed = requestSchema.safeParse(guard.body);
  if (!parsed.success) {
    return jsonResponse({ answer: 'Tell me a little more about what you want to play.' }, { status: 400 });
  }

  const question = sanitizeUserText(stripPromptInjection(parsed.data.question), 500);
  if (!question || looksLikePromptInjection(parsed.data.question)) {
    return jsonResponse(
      {
        answer: 'I can only help with game discovery questions. Try describing a mood, genre, or game you liked.',
        slots: parseDiscoveryQuery(''),
        games: [],
      },
      { status: 400 },
    );
  }

  const slots = parseDiscoveryQuery(question);
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return jsonResponse({
      answer: templateAnswer(question, slots, [], false),
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
    const fallback = templateAnswer(question, slots, games.map((game) => game.name), relaxed);
    const answer = await groqRephrase(fallback, fallback);
    return jsonResponse({ answer, slots, games, relaxed });
  } catch (error) {
    return jsonResponse({
      answer: 'I parsed your request but could not rank games right now. Try again in a moment.',
      slots,
      games: [],
      detail: sanitizeErrorMessage(error),
    });
  }
}
