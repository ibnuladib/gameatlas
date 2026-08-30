# Setup Guide

## Prerequisites

- **Node.js** (v20+ recommended) and **npm**
- **Python 3.11+** with `pip`
- **Git**
- A **Supabase** account (free tier) – create a new project at https://app.supabase.com
- A **Vercel** account (free hobby tier) – connect your GitHub repo for deployment
- **Steam Web API key** – obtain at https://steamcommunity.com/dev/apikey (no credit card needed)
- *(Optional)* **Groq API key** – obtain at https://console.groq.com for enhanced natural language features

## Local Development Steps

1. **Clone the repository** (once it's pushed) or start in the existing folder.
2. **Initialize git** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial scaffold per spec"
   ```
3. **Install Node dependencies**:
   ```bash
   npm install
   ```
4. **Set up Supabase**:
   - Create a new project.
   - In the Supabase dashboard, go to **Settings → API** and copy:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY` (publishable)
     - `SERVICE_ROLE_KEY` (server‑only)
   - `pgvector` is enabled by the first migration; you do not need to add it by hand.
5. **Configure environment variables**:
   - Copy `.env.example` to `.env.local`.
   - Fill in the values you obtained above.
   - `.env.example` is safe to commit; real `.env.local` files stay gitignored.
6. **Apply the database schema.** Every SQL file in `supabase/migrations/` must be
   applied in filename order. The later migrations move embeddings into
   `private.game_embeddings`, add the similarity RPCs the app calls, and add the
   columns the pipeline writes — the app returns empty results without them.

   Note that the service-role key **cannot** apply migrations. It authenticates to
   PostgREST, which only exposes tables and functions that already exist, so it can
   never run DDL. Pick one of these instead:

   - **Automated (recommended).** Create a personal access token at
     <https://supabase.com/dashboard/account/tokens>, add it to `.env.local` as
     `SUPABASE_ACCESS_TOKEN=sbp_...`, then run:
     ```bash
     node scripts/apply-migrations.mjs
     ```
     This is account-wide credential, so keep it local and revoke it when you are done.
     Alternatively set `DATABASE_URL` to the Postgres URI (Project Settings → Database
     → Connection string → URI) and `npm i -D pg`; the same script will use it.

   - **Manual.** Paste `supabase/PENDING_MIGRATIONS.sql` into the dashboard SQL Editor
     and run it. That file combines every migration after the initial schema and is
     idempotent, so re-running it is safe.

   Check what actually landed at any time with:
   ```bash
   node scripts/db-status.mjs
   ```

7. **Run the Python pipeline (needed to populate the map)**:
   ```bash
   cd python
   pip install -r requirements.txt
   python -m pipeline.all
   ```
   Or run stages individually: `python -m pipeline.ingest` (add `--limit 50` for a smoke test), then `reviews`, `tags`, `clean`, `embed`, `project`.

   The pipeline uses your `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to securely insert data using the Supabase REST API, so no database connection string is needed! Steam storefront calls are rate-limited; a full ~1,000-game ingest takes a while on purpose. Re-runs upsert and will not duplicate rows.
8. **Start the dev server**:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` – you should see the landing page.
9. **Deploy to Vercel**:
   - Push the repo to GitHub.
   - In Vercel, import the GitHub repo and select the **Next.js** framework.
   - Add the same env vars (except the service‑role key – keep that server‑only).
   - Vercel will build and deploy automatically.

## Daily Keep‑Alive Cron (Vercel)

Supabase free projects pause after 7 days of inactivity. Set up a Vercel cron (free tier) that runs daily:
```js
// app/api/keepalive/route.ts
import { getServerSupabaseClient } from '@/lib/supabase/client';

export async function GET() {
  const supabase = getServerSupabaseClient();
  if (!supabase) return new Response('Supabase is not configured', { status: 503 });
  await supabase.from('games').select('id').limit(1).single();
  return new Response('ok');
}
```
The route is triggered by Vercel's daily cron (configure in Vercel dashboard). No additional cost.

## Optional API: Groq for Natural Language

Set your Groq API key in your `.env.local` to enable richer, more natural responses when using the Discovery chat interface:
```
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```
The app will use Groq to rephrase explanations, but the core recommendation engine and the production build works flawlessly even without this key set.

---

**All credentials stay server‑side** – never expose `STEAM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `GROQ_API_KEY` to the browser.
