import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapFilters, MappedGame, SimilarGame } from '@/lib/games/types';
import { escapeLikePattern } from '@/lib/security/sanitize';

const GAME_COLUMNS =
  'id, steam_appid, name, description, genres, developer, publisher, release_date, header_image_url, capsule_image_url, review_score, review_count, average_playtime';

type CoordinateJoin = {
  x: number;
  y: number;
  projection_version: string;
};

function asMapped(row: Record<string, unknown>): MappedGame | null {
  const coords = row.game_coordinates;
  const point = Array.isArray(coords) ? coords[0] : coords;
  if (!point || typeof point !== 'object') return null;
  const { x, y, projection_version } = point as CoordinateJoin;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  const { game_coordinates: _ignored, ...game } = row;
  return { ...(game as Omit<MappedGame, 'x' | 'y'>), x, y, projection_version };
}

export async function listMappedGames(supabase: SupabaseClient, filters: MapFilters = {}): Promise<MappedGame[]> {
  let query = supabase
    .from('games')
    .select(`${GAME_COLUMNS}, game_coordinates!inner(x, y, projection_version)`)
    .limit(1500);

  if (filters.q) query = query.ilike('name', `%${escapeLikePattern(filters.q)}%`);
  if (filters.genre) query = query.contains('genres', [filters.genre]);
  if (filters.yearMin) query = query.gte('release_date', `${filters.yearMin}-01-01`);
  if (filters.yearMax) query = query.lte('release_date', `${filters.yearMax}-12-31`);
  if (filters.maxPlaytimeHours) query = query.lte('average_playtime', filters.maxPlaytimeHours * 60);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let games = (data ?? []).flatMap((row) => {
    const mapped = asMapped(row as Record<string, unknown>);
    return mapped ? [mapped] : [];
  });

  if (filters.tag) {
    const { data: assignments, error: tagError } = await supabase
      .from('game_tag_assignments')
      .select('game_id, game_tags!inner(name)')
      .eq('game_tags.name', filters.tag);
    if (tagError) throw new Error(tagError.message);
    const allowed = new Set((assignments ?? []).map((row: { game_id: number }) => row.game_id));
    games = games.filter((game) => allowed.has(game.id));
  }

  return games;
}

export async function getGame(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase.from('games').select(GAME_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findGamesByName(supabase: SupabaseClient, names: string[]) {
  const resolved: { id: number; name: string }[] = [];
  for (const name of names) {
    const { data, error } = await supabase
      .from('games')
      .select('id, name')
      .ilike('name', `%${escapeLikePattern(name)}%`)
      .limit(5);
    if (error) throw new Error(error.message);
    if (data?.[0]) resolved.push(data[0]);
  }
  return resolved;
}

export async function findSimilarGames(
  supabase: SupabaseClient,
  gameId: number,
  limit = 8,
): Promise<SimilarGame[]> {
  const { data, error } = await supabase.rpc('find_similar_games', {
    p_game_id: gameId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SimilarGame[];
}

export async function tagsForGames(supabase: SupabaseClient, gameIds: number[]) {
  if (gameIds.length === 0) return new Map<number, string[]>();
  const { data, error } = await supabase
    .from('game_tag_assignments')
    .select('game_id, game_tags(name)')
    .in('game_id', gameIds);
  if (error) throw new Error(error.message);
  const tags = new Map<number, string[]>();
  for (const row of data ?? []) {
    const nested = row.game_tags as { name: string } | { name: string }[] | null;
    const name = Array.isArray(nested) ? nested[0]?.name : nested?.name;
    if (!name) continue;
    const list = tags.get(row.game_id) ?? [];
    list.push(name);
    tags.set(row.game_id, list);
  }
  return tags;
}
