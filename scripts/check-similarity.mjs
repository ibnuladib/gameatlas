// Sanity-check that semantically close games actually retrieve as close.
// Spec §22 requires similarity queries to return sane results.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

const seeds = process.argv.slice(2)
const targets = seeds.length ? seeds : ['ELDEN RING', 'Terraria', 'Counter-Strike 2']

for (const name of targets) {
  const found = await (
    await fetch(`${url}/rest/v1/games?select=id,name&name=ilike.*${encodeURIComponent(name)}*&limit=1`, { headers })
  ).json()
  if (!found[0]) {
    console.log(`${name}: not in catalog\n`)
    continue
  }
  const res = await fetch(`${url}/rest/v1/rpc/find_similar_games`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_game_id: found[0].id, p_limit: 5 }),
  })
  const rows = await res.json()
  console.log(`${found[0].name} ->`)
  for (const r of rows) console.log(`   ${(1 - r.distance).toFixed(3)}  ${r.name}`)
  console.log()
}
