import { getServerSupabaseClient } from '@/lib/supabase/client';
import { findSimilarGames as querySimilar } from '@/lib/games/queries';
import type { SimilarGame } from '@/lib/games/types';

export async function findSimilarGames(gameId: number, limit = 8): Promise<SimilarGame[]> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return [];
  return querySimilar(supabase, gameId, limit);
}

export async function embedDocument(_text: string): Promise<number[]> {
  throw new Error('Embeddings are computed only by the offline Python pipeline');
}
