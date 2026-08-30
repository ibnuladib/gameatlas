import type { SupabaseClient } from '@supabase/supabase-js';
import { tagsForGames } from '@/lib/games/queries';
import { RECOMMENDATION_WEIGHTS, type RecommendationWeights } from '@/lib/recommendations/weights';

export type RankedGame = {
  id: number;
  steam_appid: number;
  name: string;
  description: string | null;
  genres: string[] | null;
  developer: string | null;
  publisher: string | null;
  header_image_url: string | null;
  review_score: number | null;
  review_count: number | null;
  average_playtime: number | null;
  platforms: string[] | null;
  score: number;
  reason: string;
  similarity: number;
};

export type RecommendOptions = {
  excludeGameIds?: number[];
  maxPlaytimeHours?: number;
  minPlaytimeHours?: number;
  minReviewScore?: number;
  genres?: string[];
  excludeGenres?: string[];
  platforms?: string[];
  yearMin?: number;
  yearMax?: number;
  mode?: 'single' | 'multiplayer' | 'co-op' | null;
  difficulty?: 'lower' | 'higher' | null;
  limit?: number;
  weights?: RecommendationWeights;
};

type MatchRow = {
  id: number;
  name: string;
  steam_appid: number;
  description: string | null;
  genres: string[] | null;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  header_image_url: string | null;
  capsule_image_url: string | null;
  review_score: number | null;
  review_count: number | null;
  average_playtime: number | null;
  platforms: string[] | null;
  steam_tags: string[] | null;
  similarity: number;
};

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const value of a) if (b.has(value)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function yearOf(date: string | null): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function matchesFilters(row: MatchRow, options: RecommendOptions): boolean {
  if (options.maxPlaytimeHours && (row.average_playtime ?? Infinity) > options.maxPlaytimeHours * 60) {
    return false;
  }
  if (options.minPlaytimeHours && (row.average_playtime ?? 0) < options.minPlaytimeHours * 60) {
    return false;
  }
  if (options.minReviewScore && (row.review_score ?? 0) < options.minReviewScore) return false;
  if (options.genres?.length) {
    const genres = new Set((row.genres ?? []).map((g) => g.toLowerCase()));
    if (!options.genres.some((g) => genres.has(g.toLowerCase()))) return false;
  }
  if (options.excludeGenres?.length) {
    const genres = new Set((row.genres ?? []).map((g) => g.toLowerCase()));
    if (options.excludeGenres.some((g) => genres.has(g.toLowerCase()))) return false;
  }
  if (options.platforms?.length) {
    const platforms = new Set((row.platforms ?? []).map((p) => p.toLowerCase()));
    if (!options.platforms.some((p) => platforms.has(p.toLowerCase()))) return false;
  }
  const year = yearOf(row.release_date);
  if (options.yearMin && year && year < options.yearMin) return false;
  if (options.yearMax && year && year > options.yearMax) return false;
  const tags = (row.steam_tags ?? []).map((t) => t.toLowerCase());
  if (options.mode === 'single' && !tags.some((t) => t.includes('single'))) return false;
  if (options.mode === 'multiplayer' && !tags.some((t) => t.includes('multi'))) return false;
  if (options.mode === 'co-op' && !tags.some((t) => t.includes('co-op') || t.includes('coop'))) return false;
  if (options.difficulty === 'lower' && tags.some((t) => t.includes('difficult') || t.includes('souls'))) return false;
  if (options.difficulty === 'higher' && tags.some((t) => t.includes('casual') || t.includes('relax'))) return false;
  return true;
}

function explain(row: MatchRow, tagOverlap: string[], relaxed: boolean): string {
  const bits = [`${Math.round(row.similarity * 100)}% semantic match`];
  if (tagOverlap.length) bits.push(`shared tags: ${tagOverlap.slice(0, 4).join(', ')}`);
  if (row.review_score) bits.push(`review score ${row.review_score}/100`);
  if (relaxed) bits.push('some filters were relaxed to find enough games');
  return bits.join(' · ');
}

export async function buildUserPreferenceVector(
  supabase: SupabaseClient,
  gameIds: number[],
): Promise<string | null> {
  if (gameIds.length === 0) return null;
  const { data, error } = await supabase.rpc('embedding_centroid', { p_game_ids: gameIds });
  if (error) throw new Error(error.message);
  if (data == null) return null;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

export async function recommendGames(
  supabase: SupabaseClient,
  seedGameIds: number[],
  options: RecommendOptions = {},
): Promise<{ games: RankedGame[]; relaxed: boolean }> {
  const weights = options.weights ?? RECOMMENDATION_WEIGHTS;
  const exclude = options.excludeGameIds ?? seedGameIds;
  const embedding = await buildUserPreferenceVector(supabase, seedGameIds);
  if (!embedding) return { games: [], relaxed: false };

  const { data, error } = await supabase.rpc('match_games', {
    p_embedding: embedding,
    p_exclude: exclude,
    p_limit: 60,
  });
  if (error) throw new Error(error.message);
  const matches = (data ?? []) as MatchRow[];

  let relaxed = false;
  let filtered = matches.filter((row) => matchesFilters(row, options));
  if (filtered.length === 0 && matches.length > 0) {
    relaxed = true;
    const loosened: RecommendOptions = {
      ...options,
      maxPlaytimeHours: undefined,
      minPlaytimeHours: undefined,
      minReviewScore: undefined,
    };
    filtered = matches.filter((row) => matchesFilters(row, loosened));
  }

  const candidateIds = filtered.map((row) => row.id);
  const seedTags = await tagsForGames(supabase, seedGameIds);
  const candidateTags = await tagsForGames(supabase, candidateIds);
  const userTagSet = new Set([...seedTags.values()].flat());
  const { data: seedRows } = await supabase.from('games').select('genres').in('id', seedGameIds);
  const userGenres = new Set(
    (seedRows ?? []).flatMap((row: { genres: string[] | null }) =>
      (row.genres ?? []).map((genre) => genre.toLowerCase()),
    ),
  );
  const maxReviews = Math.max(1, ...filtered.map((row) => row.review_count ?? 0));

  const ranked: RankedGame[] = filtered
    .map((row) => {
      const tags = new Set(candidateTags.get(row.id) ?? []);
      const overlap = [...tags].filter((tag) => userTagSet.has(tag));
      const tagScore = jaccard(tags, userTagSet);
      const popularity = Math.log10((row.review_count ?? 0) + 1) / Math.log10(maxReviews + 1);
      const reviewQuality = (row.review_score ?? 0) / 100;
      const genreOverlap = (row.genres ?? []).some((g) => userGenres.has(g.toLowerCase())) ? 1 : tagScore;
      const score =
        weights.semantic * row.similarity +
        weights.tag * tagScore +
        weights.popularity * popularity +
        weights.reviewQuality * reviewQuality +
        weights.preference * (0.5 * row.similarity + 0.5 * genreOverlap);
      return {
        id: row.id,
        steam_appid: row.steam_appid,
        name: row.name,
        description: row.description,
        genres: row.genres,
        developer: row.developer,
        publisher: row.publisher,
        header_image_url: row.header_image_url,
        review_score: row.review_score,
        review_count: row.review_count,
        average_playtime: row.average_playtime,
        platforms: row.platforms,
        score,
        similarity: row.similarity,
        reason: explain(row, overlap, relaxed),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 10);

  return { games: ranked, relaxed };
}
