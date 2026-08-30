import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { fetchSteamLibrary, resolveSteamId, SteamUnavailableError } from '@/lib/steam/api';
import { guardApiRequest, jsonResponse } from '@/lib/security/api-guard';
import { sanitizeErrorMessage } from '@/lib/security/sanitize';

const bodySchema = z.object({ steam: z.string().trim().min(2).max(200) });

export async function POST(request: NextRequest) {
  const guard = await guardApiRequest(request, { requireJsonPost: true });
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(guard.body);
  if (!parsed.success) {
    return jsonResponse({ error: 'Enter a Steam ID or profile URL' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) return jsonResponse({ error: 'Supabase is not configured' }, { status: 503 });

  try {
    const steamId = await resolveSteamId(parsed.data.steam);
    const library = await fetchSteamLibrary(steamId);
    if (library.length === 0) {
      return jsonResponse({
        steamId,
        games: [],
        unavailable: [],
        notice: 'No games were returned. The profile may be private, or Steam returned an empty library.',
      });
    }
    const appids = library.map((game) => game.appid);
    const matched: {
      id: number;
      steam_appid: number;
      name: string;
      header_image_url: string | null;
      genres: string[] | null;
      review_score: number | null;
    }[] = [];
    for (let i = 0; i < appids.length; i += 120) {
      const { data, error } = await supabase
        .from('games')
        .select('id, steam_appid, name, header_image_url, genres, review_score')
        .in('steam_appid', appids.slice(i, i + 120));
      if (error) throw new Error(error.message);
      matched.push(...(data ?? []));
    }
    const byApp = new Map(matched.map((row) => [row.steam_appid, row]));
    const games = [];
    const unavailable = [];
    for (const item of library) {
      const catalog = byApp.get(item.appid);
      if (catalog) {
        games.push({ ...catalog, playtimeMinutes: item.playtimeMinutes, recent: item.recent });
      } else if (item.playtimeMinutes > 0) {
        unavailable.push({ appid: item.appid, name: item.name ?? `App ${item.appid}` });
      }
    }
    games.sort((a, b) => Number(b.recent) - Number(a.recent) || b.playtimeMinutes - a.playtimeMinutes);
    return jsonResponse({ steamId, games, unavailable: unavailable.slice(0, 25) });
  } catch (error) {
    if (error instanceof SteamUnavailableError) {
      return jsonResponse({ error: error.message, games: [], unavailable: [] });
    }
    return jsonResponse({ error: sanitizeErrorMessage(error, 'Lookup failed') }, { status: 500 });
  }
}
