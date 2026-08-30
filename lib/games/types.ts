export type Game = {
  id: number;
  steam_appid: number;
  name: string;
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
};

export type MappedGame = Game & { x: number; y: number; projection_version?: string };

export type SimilarGame = {
  id: number;
  name: string;
  steam_appid: number;
  header_image_url: string | null;
  genres: string[] | null;
  review_score: number | null;
  distance: number;
};

export type MapFilters = {
  q?: string;
  genre?: string;
  tag?: string;
  yearMin?: number;
  yearMax?: number;
  maxPlaytimeHours?: number;
};
