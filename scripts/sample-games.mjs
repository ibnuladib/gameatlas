// Spot-check ingested catalog rows for the fields the app filters and ranks on.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/games?select=name,review_score,review_count,average_playtime,genres,platforms,steam_tags,release_date&order=review_count.desc&limit=10`,
  { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
)
const rows = await res.json()
for (const r of rows) {
  const hours = r.average_playtime ? `${(r.average_playtime / 60).toFixed(0)}h` : 'NULL'
  console.log(
    `${r.name.padEnd(32).slice(0, 32)} score=${String(r.review_score ?? 'NULL').padStart(4)} ` +
      `reviews=${String(r.review_count ?? 0).padStart(7)} playtime=${hours.padStart(6)} ` +
      `genres=${(r.genres ?? []).length} tags=${(r.steam_tags ?? []).length} ${r.release_date ?? 'no-date'}`
  )
}

const nulls = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/games?select=id&average_playtime=is.null`,
  {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  }
)
console.log(`\ngames missing average_playtime: ${nulls.headers.get('content-range')?.split('/')[1]}`)
