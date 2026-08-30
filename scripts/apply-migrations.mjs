// Apply SQL migrations to Supabase without the dashboard.
//
// The service-role key cannot do this: it authenticates to PostgREST, which
// only exposes existing tables and functions, so it can never run DDL. Raw SQL
// needs either the Management API (a personal access token, sbp_...) or a
// direct Postgres connection (DATABASE_URL).
//
// Usage:  node scripts/apply-migrations.mjs [file.sql]
// Default file: supabase/PENDING_MIGRATIONS.sql

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const out = {}
  for (const name of ['.env.local', '.env']) {
    let text
    try {
      text = readFileSync(resolve(root, name), 'utf8')
    } catch {
      continue
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const i = trimmed.indexOf('=')
      if (i === -1) continue
      const key = trimmed.slice(0, i).trim()
      if (!(key in out)) out[key] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return { ...out, ...process.env }
}

const env = loadEnv()
const sqlPath = process.argv[2] ?? 'supabase/PENDING_MIGRATIONS.sql'
const sql = readFileSync(resolve(root, sqlPath), 'utf8')

async function viaManagementApi(token) {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 600)}`)
  console.log(`Applied ${sqlPath} to project ${ref}.`)
}

async function viaPostgres(url) {
  let pg
  try {
    pg = await import('pg')
  } catch {
    throw new Error('DATABASE_URL is set but the "pg" package is missing. Run: npm i -D pg')
  }
  const client = new pg.default.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`Applied ${sqlPath} over a direct Postgres connection.`)
  } finally {
    await client.end()
  }
}

const token = env.SUPABASE_ACCESS_TOKEN
if (token) {
  await viaManagementApi(token)
} else if (env.DATABASE_URL) {
  await viaPostgres(env.DATABASE_URL)
} else {
  console.error(
    [
      'No credential available that can run SQL.',
      '',
      'The service-role key you already have cannot run DDL - it only speaks to',
      'PostgREST. Add ONE of the following to .env.local:',
      '',
      '  SUPABASE_ACCESS_TOKEN=sbp_...   (recommended)',
      '    Create at https://supabase.com/dashboard/account/tokens',
      '',
      '  DATABASE_URL=postgresql://...   (needs "npm i -D pg")',
      '    Dashboard -> Project Settings -> Database -> Connection string -> URI',
    ].join('\n'),
  )
  process.exit(1)
}
