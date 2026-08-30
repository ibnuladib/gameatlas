// Quick health check: what schema exists and how much pipeline output is in Supabase.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function count(table, select = '*') {
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  })
  if (!res.ok) return `ERROR ${res.status}: ${(await res.text()).slice(0, 160)}`
  return res.headers.get('content-range')?.split('/')[1] ?? '?'
}

console.log('--- row counts ---')
for (const t of ['games', 'game_tags', 'game_tag_assignments', 'game_reviews', 'game_coordinates', 'profiles']) {
  console.log(`${t}: ${await count(t)}`)
}

console.log('--- games columns ---')
for (const col of ['embedding_document', 'platforms', 'steam_tags', 'slug', 'average_playtime']) {
  const res = await fetch(`${url}/rest/v1/games?select=${col}&limit=1`, { headers })
  console.log(`${col}: ${res.ok ? 'present' : (await res.text()).slice(0, 100)}`)
}

console.log('--- rpcs ---')
// Every probe must pass the full argument list: PostgREST resolves overloads by
// argument name, so calling with {} reports PGRST202 even for a function that
// exists. Args are chosen to fail on a cast or a missing row rather than write.
const rpcs = {
  find_similar_games: { p_game_id: -1, p_limit: 1 },
  embedding_centroid: { p_game_ids: [] },
  match_games: { p_embedding: 'not-a-vector', p_exclude: [], p_limit: 1 },
  get_embeddings: { p_model: 'x', p_model_version: 'y' },
  upsert_embedding: { p_game_id: -1, p_embedding: 'not-a-vector', p_model: 'x', p_model_version: 'y' },
}
for (const [name, body] of Object.entries(rpcs)) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await res.text()
  console.log(`${name}: ${text.includes('PGRST202') ? 'MISSING' : `exists (${res.status})`}`)
}
