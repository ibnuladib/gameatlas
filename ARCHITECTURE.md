# Architecture Overview

## High‑Level Components

1. **Game Knowledge Base** – ~1,000 Steam games stored in Supabase (`games` table) with metadata, tags, and a few curated reviews.
2. **Semantic Game Map** – Embedding each game with `bge‑small‑en‑v1.5`, projecting vectors to 2‑D using UMAP (offline). The resulting `x`, `y` coordinates are stored in `game_coordinates` and rendered with Plotly.js (scattergl) on the client.
3. **Personalized Recommendation Engine** – Builds a user preference vector from their Steam play history (weighted centroid of owned games) and ranks candidates using a weighted scoring formula (semantic similarity, tag similarity, popularity, review quality, preference match).
4. **Natural‑Language Discovery Assistant** – A rule‑based parser extracts constraints from user questions (e.g., “shorter than 20 h”, “not RPG”) and runs the same ranking pipeline. Optionally uses the Groq API (e.g. Llama 3.1) for richer phrasing, but never strictly depends on it in production.

## Data Flow

```
Game Metadata → Clean/Normalize → Document → BGE Embedding → pgvector
      ↓                                                       ↓
Similarity Search (cosine)                                 UMAP (offline)
      ↓                                                       ↓
Game Coordinates (x,y)                              Interactive 2‑D Map (Plotly)
```

## Field Provenance

Two ranked/filtered fields are not served directly by Steam's storefront and are
derived in the pipeline. Both matter because the recommendation engine and the
map filters read them:

- **`review_score`** – percentage of positive Steam reviews, from SteamSpy's vote
  counts, used whenever a game has at least 50 votes. Metacritic is the fallback,
  since it covers only a minority of the catalog.
- **`average_playtime`** – median `playtime_forever` across the reviewers sampled
  in `game_reviews`, written by the clean stage and stored in minutes. SteamSpy
  stopped publishing playtime (its fields now return 0) and the storefront never
  exposed it, so this is the only free source that carries no ToS risk. Reviewers
  play more than average, so the UI presents it as an approximation.

## Backend Stack

- **Next.js (App Router)** – Server‑side route handlers for API endpoints, Supabase client, and nightly cron.
- **Supabase** – Postgres + pgvector + Auth + Row‑Level Security.
- **Python batch pipeline** – Runs locally or via GitHub Actions (`python -m pipeline.all` from `python/`) to ingest Steam data, clean text, fetch reviews, compute embeddings, and project with UMAP. Similarity search is exposed to the app as `find_similar_games` / `match_games` SQL functions so vectors stay in `private.game_embeddings`.
- **Vercel Hobby** – Deploys the Next.js app; provides one free daily cron to ping Supabase and keep the DB warm.

## Security Model

- Server‑only env vars: `STEAM_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`.
- RLS protects `profiles`, `user_game_history`, `recommendations`.
- Public tables (`games`, `game_tags`, etc.) are read‑only for unauthenticated users.
- All external input validated with Zod schemas.

## Extensibility

- Embedding model can be swapped by updating `embeddings` scripts – vectors are versioned per row.
- Tag taxonomy is stored in structured tables (`game_tags`, `game_tag_assignments`).
- Optional `GameLengthProvider` interface for future integration with HowLongToBeat or similar services. Only the no-op implementation ships: there is no official public API and scraping carries ToS risk, so playtime currently comes from the review sample described above.
- Groq API adds richer NL generation for development/production; the core logic works perfectly without it.

---

For a detailed walk‑through of each subsystem, see the full spec in `GAMEATLAS_SPEC.md`.
