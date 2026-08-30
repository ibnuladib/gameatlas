import { z } from 'zod';
import { getSecret } from '@/lib/env/server';

const steamKey = () => getSecret('STEAM_API_KEY') ?? '';

const ownedGamesSchema = z.object({
  response: z
    .object({
      games: z
        .array(
          z.object({
            appid: z.number(),
            name: z.string().optional(),
            playtime_forever: z.number().optional(),
            rtime_last_played: z.number().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const recentGamesSchema = z.object({
  response: z
    .object({
      games: z
        .array(
          z.object({
            appid: z.number(),
            name: z.string().optional(),
            playtime_forever: z.number().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const vanitySchema = z.object({
  response: z.object({
    success: z.number(),
    steamid: z.string().optional(),
    message: z.string().optional(),
  }),
});

export type SteamLibraryGame = {
  appid: number;
  name?: string;
  playtimeMinutes: number;
  lastPlayed?: number;
  recent: boolean;
};

export class SteamUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SteamUnavailableError';
  }
}

export function parseSteamInput(raw: string): { kind: 'id' | 'vanity'; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const profiles = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profiles) return { kind: 'id', value: profiles[1] };
  const vanity = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (vanity) return { kind: 'vanity', value: vanity[1] };
  if (/^\d{17}$/.test(trimmed)) return { kind: 'id', value: trimmed };
  if (/^[A-Za-z0-9_\-]+$/.test(trimmed)) return { kind: 'vanity', value: trimmed };
  return null;
}

async function steamGet(path: string, params: Record<string, string>): Promise<unknown> {
  const key = steamKey();
  if (!key) throw new SteamUnavailableError('STEAM_API_KEY is not configured');
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new SteamUnavailableError(`Steam API responded ${res.status}`);
    return await res.json();
  } catch (error) {
    if (error instanceof SteamUnavailableError) throw error;
    throw new SteamUnavailableError('Steam API timed out or could not be reached');
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveSteamId(input: string): Promise<string> {
  const parsed = parseSteamInput(input);
  if (!parsed) throw new SteamUnavailableError('That does not look like a Steam ID or profile URL');
  if (parsed.kind === 'id') return parsed.value;
  const json = vanitySchema.parse(await steamGet('ISteamUser/ResolveVanityURL/v1/', { vanityurl: parsed.value }));
  if (json.response.success !== 1 || !json.response.steamid) {
    throw new SteamUnavailableError(json.response.message ?? 'Could not resolve that Steam profile');
  }
  return json.response.steamid;
}

export async function fetchSteamLibrary(steamId: string): Promise<SteamLibraryGame[]> {
  const [ownedRaw, recentRaw] = await Promise.all([
    steamGet('IPlayerService/GetOwnedGames/v1/', {
      steamid: steamId,
      include_appinfo: '1',
      include_played_free_games: '1',
    }),
    steamGet('IPlayerService/GetRecentlyPlayedGames/v1/', { steamid: steamId }),
  ]);
  const owned = ownedGamesSchema.parse(ownedRaw).response?.games ?? [];
  const recent = new Set((recentGamesSchema.parse(recentRaw).response?.games ?? []).map((game) => game.appid));
  return owned.map((game) => ({
    appid: game.appid,
    name: game.name,
    playtimeMinutes: game.playtime_forever ?? 0,
    lastPlayed: game.rtime_last_played,
    recent: recent.has(game.appid),
  }));
}

const storefrontGameSchema = z.object({
  name: z.string(),
  steam_appid: z.number().optional(),
  short_description: z.string().optional(),
  detailed_description: z.string().optional(),
  header_image: z.string().url().optional(),
  capsule_image: z.string().url().optional(),
  genres: z.array(z.object({ description: z.string() })).optional(),
});

export async function fetchSteamGame(appId: number) {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null) return null;
  const entry = (data as Record<string, { data?: unknown; success?: boolean }>)[String(appId)];
  if (!entry?.success || !entry.data) return null;
  const parsed = storefrontGameSchema.safeParse(entry.data);
  return parsed.success ? parsed.data : null;
}
