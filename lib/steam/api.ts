import { supabase } from '@/lib/supabase/client';
import { z } from 'zod';

const SteamApiKey = process.env.STEAM_API_KEY;
if (!SteamApiKey) {
  throw new Error('STEAM_API_KEY is not set');
}

// Example Zod schema for a game detail response (partial)
export const SteamGameSchema = z.object({
  appid: z.number(),
  name: z.string(),
  short_description: z.string().optional(),
  detailed_description: z.string().optional(),
  genres: z.array(z.object({ description: z.string() })).optional(),
  header_image: z.string().url().optional(),
  capsule_image: z.string().url().optional(),
});

export type SteamGame = z.infer<typeof SteamGameSchema>;

/** Fetch game details from Steam Storefront API */
export async function fetchSteamGame(appId: number): Promise<SteamGame | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const gameData = data[appId]?.data;
  if (!gameData) return null;
  const parsed = SteamGameSchema.safeParse(gameData);
  return parsed.success ? parsed.data : null;
}
