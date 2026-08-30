import { NextRequest } from 'next/server';
import { z } from 'zod';
import { recommendGames } from '@/lib/recommendations/engine';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { fetchSteamLibrary, resolveSteamId, SteamUnavailableError } from '@/lib/steam/api';
import { guardApiRequest, jsonResponse } from '@/lib/security/api-guard';
import { sanitizeErrorMessage } from '@/lib/security/sanitize';

const bodySchema = z.object({
  steam: z.string().trim().min(2).max(200).optional(),
  gameIds: z.array(z.number().int().positive()).max(50).optional(),
  maxPlaytimeHours: z.number().int().positive().max(500).optional(),
  minReviewScore: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const guard = await guardApiRequest(request, { requireJsonPost: true });
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(guard.body);
  if (!parsed.success) return jsonResponse({ error: 'Invalid request' }, { status: 400 });

  const supabase = getServerSupabaseClient();
  if (!supabase) return jsonResponse({ error: 'Supabase is not configured' }, { status: 503 });

  try {
    let seedIds = parsed.data.gameIds ?? [];
    let exclude = [...seedIds];
    if (parsed.data.steam) {
      const steamId = await resolveSteamId(parsed.data.steam);
      const library = await fetchSteamLibrary(steamId);
      const appids = library.map((game) => game.appid);
      const mapped: { id: number; steam_appid: number }[] = [];
      for (let i = 0; i < appids.length; i += 120) {
        const { data } = await supabase
          .from('games')
          .select('id, steam_appid')
          .in('steam_appid', appids.slice(i, i + 120));
        mapped.push(...(data ?? []));
      }
      exclude = mapped.map((row) => row.id);
      const weighted = library
        .map((game) => {
          const row = mapped.find((item) => item.steam_appid === game.appid);
          if (!row) return null;
          const recency = game.recent ? 3 : 1;
          const hours = Math.log10((game.playtimeMinutes || 1) / 60 + 1);
          return { id: row.id, weight: recency * hours };
        })
        .filter((row): row is { id: number; weight: number } => row !== null)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 25)
        .map((row) => row.id);
      seedIds = weighted;
    }
    if (seedIds.length === 0) {
      return jsonResponse({
        games: [],
        relaxed: false,
        notice: 'No catalog games to build a preference vector from. Connect a public Steam library or pick seed games.',
      });
    }
    const result = await recommendGames(supabase, seedIds, {
      excludeGameIds: exclude,
      maxPlaytimeHours: parsed.data.maxPlaytimeHours,
      minReviewScore: parsed.data.minReviewScore,
    });
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof SteamUnavailableError) {
      return jsonResponse({ games: [], relaxed: false, notice: error.message });
    }
    return jsonResponse({ error: sanitizeErrorMessage(error, 'Recommendation failed') }, { status: 500 });
  }
}
