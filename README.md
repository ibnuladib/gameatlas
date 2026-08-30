# GameAtlas

**Semantic Game Discovery, Visualization & Recommendation Platform**

GameAtlas is a free‑tier, serverless web app that lets users explore a curated set of ~1,000 Steam games on an interactive 2‑D map, get personalized recommendations, and ask natural‑language questions – **without any paid LLM or external API costs**.

- **Frontend**: Next.js 13 (App Router) + TypeScript + Tailwind CSS with a hand-rolled design system in `app/globals.css`
- **Database**: Supabase (PostgreSQL) with `pgvector` for embeddings & similarity search
- **Embeddings**: Offline BGE small model (`sentence‑transformers`), stored in Postgres
- **Deployment**: Vercel Hobby (free) – static hosting + serverless functions + daily cron for Supabase keep‑alive
- **Auth**: Supabase Auth (Steam OpenID optional, API key server‑side only)
- **No paid LLM** – all inference runs locally during development; production relies on rule‑based parsing.

See `ARCHITECTURE.md` for a deeper dive, and `SETUP.md` for getting the development environment up and running.
