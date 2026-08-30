export type ParsedQuery = {
  similar_to: string[];
  max_playtime_hours: number | null;
  /**
   * "shorter"/"longer" is relative to the games named in the query, so it can
   * only become an hour bound once those games are resolved against the
   * catalog. The caller does that; the parser just records the intent.
   */
  relative_length: 'shorter' | 'longer' | null;
  exclude_genres: string[];
  genres: string[];
  difficulty: 'lower' | 'higher' | null;
  mode: 'single' | 'multiplayer' | 'co-op' | null;
};

const GENRE_ALIASES: Record<string, string> = {
  rpg: 'RPG',
  action: 'Action',
  adventure: 'Adventure',
  strategy: 'Strategy',
  simulation: 'Simulation',
  shooter: 'Shooter',
  racing: 'Racing',
  platformer: 'Platformer',
  puzzle: 'Puzzle',
  horror: 'Horror',
};

// Where a title list stops and the actual request begins.
const TRAILING_CLAUSE = /\b(?:what|which|any|anything|something|got|give|recommend|suggest|now|next|else|but)\b.*$/;

function splitTitleList(raw: string): string[] {
  return raw
    .split(/,|\band\b|&/)
    .map((part) => part.replace(TRAILING_CLAUSE, '').replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, ''))
    .filter((part) => part.length >= 3 && part.length <= 40);
}

export function parseDiscoveryQuery(question: string): ParsedQuery {
  const text = question.trim();
  const lower = text.toLowerCase();
  const similar_to: string[] = [];
  for (const match of text.matchAll(/"([^"]+)"/g)) similar_to.push(match[1]);
  for (const match of lower.matchAll(/(?:like|similar to)\s+([a-z0-9:'\- ]{3,40}?)(?:\s+but|\s+and|,|$)/g)) {
    similar_to.push(match[1].trim());
  }
  // "I played X, Y and Z - what next?" names games without any "like" trigger.
  for (const match of lower.matchAll(
    /\b(?:i(?:'ve|\s+have)?\s+(?:just\s+)?(?:played|finished|beat(?:en)?|loved|enjoyed))\s+([^?.!;]+)/g,
  )) {
    similar_to.push(...splitTitleList(match[1]));
  }

  let max_playtime_hours: number | null = null;
  const hours = lower.match(/(?:under|less than|shorter than|max(?:imum)?)\s+(\d+)\s*(?:h|hr|hrs|hours)?/);
  if (hours) max_playtime_hours = Number(hours[1]);
  else if (/\b(short|weekend|quick)\b/.test(lower)) max_playtime_hours = 15;

  // An explicit number always wins over a comparative.
  let relative_length: ParsedQuery['relative_length'] = null;
  if (max_playtime_hours === null) {
    if (/\b(shorter|briefer)\b/.test(lower)) relative_length = 'shorter';
    else if (/\b(longer|lengthier|meatier)\b/.test(lower)) relative_length = 'longer';
  }

  const exclude_genres: string[] = [];
  const genres: string[] = [];
  for (const [alias, label] of Object.entries(GENRE_ALIASES)) {
    const negated = new RegExp(`\\b(?:not|n't|no|except)\\s+(?:an?\\s+)?${alias}\\b`);
    if (negated.test(lower)) exclude_genres.push(label);
    else if (new RegExp(`\\b${alias}\\b`).test(lower)) genres.push(label);
  }

  let difficulty: ParsedQuery['difficulty'] = null;
  if (/\b(easier|chill|relaxing|casual|lower difficulty)\b/.test(lower)) difficulty = 'lower';
  if (/\b(harder|souls|difficult|challenging)\b/.test(lower)) difficulty = 'higher';

  let mode: ParsedQuery['mode'] = null;
  if (/\bco-?op\b/.test(lower)) mode = 'co-op';
  else if (/\bmultiplayer|with friends\b/.test(lower)) mode = 'multiplayer';
  else if (/\bsingle[- ]player\b/.test(lower)) mode = 'single';

  return {
    similar_to: [...new Set(similar_to.map((name) => name.trim()).filter(Boolean))],
    max_playtime_hours,
    relative_length,
    exclude_genres,
    genres,
    difficulty,
    mode,
  };
}

export function templateAnswer(question: string, parsed: ParsedQuery, names: string[], relaxed: boolean): string {
  const constraints: string[] = [];
  if (parsed.similar_to.length) constraints.push(`near ${parsed.similar_to.join(', ')}`);
  if (parsed.max_playtime_hours) constraints.push(`under ~${parsed.max_playtime_hours} hours`);
  else if (parsed.relative_length) constraints.push(`${parsed.relative_length} than what you named`);
  if (parsed.exclude_genres.length) constraints.push(`not ${parsed.exclude_genres.join(', ')}`);
  if (parsed.genres.length) constraints.push(parsed.genres.join(', '));
  if (parsed.mode) constraints.push(parsed.mode);
  if (parsed.difficulty) constraints.push(`${parsed.difficulty} difficulty`);
  const focus = constraints.length ? constraints.join('; ') : 'the themes in your request';
  if (!names.length) {
    return `I understood ${focus}, but the catalog does not have matching ranked games yet. Ingest the dataset and try again.`;
  }
  const relax = relaxed ? ' I loosened a filter so you still get options.' : '';
  return `For “${question.trim()}” I’m ranking games using ${focus}.${relax} Top matches: ${names.join(', ')}. Reasons use tag overlap and similarity scores from the database — not invented features.`;
}
