/** Ranking weights live here only — never in UI components. */
export const RECOMMENDATION_WEIGHTS = {
  semantic: 0.5,
  tag: 0.2,
  popularity: 0.1,
  reviewQuality: 0.1,
  preference: 0.1,
} as const;

export type RecommendationWeights = typeof RECOMMENDATION_WEIGHTS;
