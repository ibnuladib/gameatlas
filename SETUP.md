# Setup Guide

## Prerequisites

- **Node.js** (v20+ recommended) and **npm**
- **Python 3.11+** with `pip`
- **Git**
- A **Supabase** account (free tier) – create a new project at https://app.supabase.com
- A **Vercel** account (free hobby tier) – connect your GitHub repo for deployment
- **Steam Web API key** – obtain at https://steamcommunity.com/dev/apikey (no credit card needed)

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
   - Run the initial migration to create the schema:
     ```bash
     supabase db reset --file supabase/migrations/20230829120000_initial_schema.sql
     ```
   - Enable `pgvector` extension (Supabase does this automatically when you use `vector` column type).
5. **Configure environment variables**:
   - Copy `.env.example` to `.env.local`.
   - Fill in the values you obtained above.
   - **Never commit** `.env*` files – they are git‑ignored.
6. **Run the Python pipeline (optional – needed to populate data)**:
   ```bash
   cd python/pipeline
   pip install -r requirements.txt
   python -m pipeline.all
   ```
   This pulls ~1,000 games from Steam, cleans text, fetches sample reviews, computes embeddings, runs UMAP, and upserts all data into Supabase.
7. **Start the dev server**:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` – you should see the landing page.
8. **Deploy to Vercel**:
   - Push the repo to GitHub.
   - In Vercel, import the GitHub repo and select the **Next.js** framework.
   - Add the same env vars (except the service‑role key – keep that server‑only).
   - Vercel will build and deploy automatically.

## Daily Keep‑Alive Cron (Vercel)

Supabase free projects pause after 7 days of inactivity. Set up a Vercel cron (free tier) that runs daily:
```js
// app/api/keepalive/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Simple cheap query to keep DB warm
  await supabase.from('games').select('id', { limit: 1 });
  return new Response('ok');
}
```
The route is triggered by Vercel's daily cron (configure in Vercel dashboard). No additional cost.

## Optional Local LLM (development only)

If you have Ollama installed locally, set:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```
The app will use it for richer natural‑language phrasing, but the production build works without these env vars.

---

**All credentials stay server‑side** – never expose `STEAM_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.
