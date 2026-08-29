# GameAtlas — Semantic Game Discovery, Visualization & Recommendation Platform
### Cursor Agent Build Spec (v2 — refactored for guaranteed $0 operating cost)

---

## 0. What changed from the original spec, and why

This version keeps the product idea intact and fixes things that would have either cost money, silently broken on a free-tier deploy, or referenced services that don't fit a solo $0 project:

| Removed / changed | Reason |
|---|---|
| **"Stripe Projects" for provisioning Supabase** | Real tool, but it's a CLI in public preview that sits between you and your provider accounts and is built around a "sync credentials, upgrade with a Shared Payment Token" billing flow. That's unnecessary indirection for a single free Supabase project — create the Supabase project directly at supabase.com. Removed entirely from section 3. |
| **Re-hosting game cover art in Supabase Storage** | Never store or proxy Steam images. Link directly to Steam's CDN (`header_image` / `capsule_image` URLs from the Storefront API). This keeps the 1 GB free storage bucket and 2 GB/month bandwidth budget entirely for your own use (or unused). |
| **Python embedding pipeline described as a "service"** | Clarified: it is an **offline, one-time (then periodic) batch job**, run on your own machine or in a free GitHub Actions job — never a deployed, always-on process. A persistent Python server is the single fastest way to blow past every free tier. |
| **Ollama as a runtime dependency of the deployed app** | Ollama needs a machine to run on. Vercel's free serverless functions cannot run it. Clarified: Ollama is a **local-development-only** optional enhancement; the deployed app always uses the deterministic explanation/ranking engine, never a hard dependency on any LLM. |
| **HowLongToBeat integration** | Downgraded from a named integration to an optional, clearly-flagged provider interface. There is no official public API; scraping it carries ToS risk. The spec now treats it as a stub you may or may not fill in later. |
| **Missing hosting plan** | The original spec never said where the Next.js app itself runs. Added: **Vercel Hobby (free)** for the frontend/API, with the specific limits that matter (see §2). |
| **Missing keep-alive plan** | Supabase free projects pause after 7 days of inactivity. Added a daily Vercel Cron (free tier allows this) that pings the DB. |
| **Trimmed** | Repeated ASCII pipeline diagrams, redundant restatements of the same architecture, and the overly long tag-taxonomy prose (turned into a compact table). |

Everything else below is the full, still-detailed spec, refactored to be internally consistent.

---

## 1. Core Product Concept

Four components:

1. **Game Knowledge Base** — ~1,000 Steam games with metadata, tags, and a sample of reviews.
2. **Semantic Game Map** — each game embedded into a vector, projected to 2D with UMAP, rendered as an interactive scatter plot.
3. **Personalized Recommendation Engine** — deterministic, vector + tag + metadata based ranking, using a user's Steam history.
4. **Natural-Language Discovery Assistant** — a chat box that turns questions like *"something like Elden Ring but shorter"* into structured filters, without requiring a paid LLM.

```
Game Metadata → Clean/Normalize → Game Document → Local Embedding (BGE) → pgvector
                                                                            ↓
                                                                    Similarity Search
                                                                            ↓
                                                                      UMAP (offline)
                                                                            ↓
                                                              Interactive 2D Game Map

Steam User → Recently Played / Owned → Match to Knowledge Base → Weighted Preference Vector
                                                                            ↓
                                                              Candidate Generation → Filter → Rank

User Question → Rule-based Intent/Slot Extraction → Vector + Metadata Retrieval → Rank → Explain
```

---

## 2. Technology Stack (all free tiers, verified)

### Frontend & hosting
- **Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui**
- **Plotly.js** (WebGL scattergl trace) for the map — handles 1,000 points comfortably in-browser
- **TanStack Query** for client data fetching/caching
- **Hosting: Vercel Hobby plan (free)** — deploys the app and all Route Handlers/Server Actions.
  - Known Hobby-tier limits to design around: serverless function execution capped at 10s (default) / up to 60s (extendable, still free); **1 cron job per day** on the free plan — use it for the Supabase keep-alive ping.
  - Server Components by default; Client Components only where the map, filters, or chat need interactivity.

### Database
- **Supabase (free project, created directly at supabase.com — no CLI provisioning layer needed)**, providing Postgres, `pgvector`, Auth, and Row Level Security, all in one free project.
- Free-tier ceiling to design around: **500 MB database storage**, 2 GB egress/month, project **auto-pauses after 7 days of inactivity** (handled by the daily cron ping).
- 1,000 games × a 384-dim `bge-small` vector is ≈ 1.5 MB of raw vector data — storage is not a real constraint here; the reviews table is the thing to keep lean (see §6).

### AI / Embeddings — no paid API, ever
- **`BAAI/bge-small-en-v1.5`** (384 dimensions) as the default. `BAAI/bge-base-en-v1.5` (768 dim) is a documented drop-in alternative if quality needs it and storage/CPU budget allows.
- Runs via `sentence-transformers`, **offline**, as a Python batch script — not a deployed service.
- Every embedding row stores `model` + `model_version` so a future model swap never silently overwrites or mixes vector spaces.

### Data processing (offline, not deployed)
Python 3 + `pandas`, `httpx`, `sentence-transformers`, `numpy`, `scikit-learn`, `umap-learn`, `psycopg[binary]`, `tqdm`.
Run this pipeline from your own machine, or as a manually-triggered **GitHub Actions workflow** (free for public/private repos within Actions' free minutes) that writes straight to Supabase over its connection string. Either way, it never runs on every page load, and it never runs as a background daemon that needs hosting.

### Optional local LLM (development only)
- `OLLAMA_BASE_URL` / `OLLAMA_MODEL` remain supported as **opt-in, local-only** config for developers who want richer natural-language explanations while building. The deployed production app must work fully with these unset — this is a hard requirement, not a soft preference, because Vercel cannot host Ollama for free (or at all, on Hobby).

---

## 3. Required Accounts & Credentials

All free, no card required except where a provider mandates verification (Vercel/Supabase sign-up does not require one on Hobby/Free):

| Service | What you get | Notes |
|---|---|---|
| **Supabase** | Postgres + pgvector + Auth + RLS | Create the project directly in the dashboard. Grab the project URL, anon/publishable key, and service-role key. |
| **Vercel** | Hosting + serverless functions + 1 free daily cron | Connect the GitHub repo; env vars set in the Vercel dashboard, never committed. |
| **Steam Web API key** | `GetOwnedGames`, `GetRecentlyPlayedGames`, `GetSingleGamePlaytime` (`IPlayerService`) | Free, instant, from steamcommunity.com/dev/apikey. Server-side only — `STEAM_API_KEY` never reaches the browser. |
| **GitHub** | Repo + optional Actions runner for the offline pipeline | Free tier is enough for a script that runs occasionally. |

No Stripe account, no OpenAI/Anthropic/Gemini key, no vector-DB SaaS, no image CDN account are required for the MVP.

`SETUP.md` must spell out, in order, how to obtain each of the above and which `.env` variable each one fills.

---

## 4. Game Dataset & Ingestion

Target: ~1,000 popular Steam games.

Sources (all free, no key beyond the Steam Web API key for the player-data calls — the storefront calls below need no key):
- `ISteamApps/GetAppList` — full app ID list, to seed candidates.
- `store.steampowered.com/api/appdetails?appids={id}` — name, description, genres, categories, developer, publisher, release date, header/capsule image **URLs** (link, don't download), platforms.
- `store.steampowered.com/appreviews/{id}?json=1` — review text and scores; pull a small, configurable sample (5–10 per game), not the full review set.

Per-game record:
```
appid, name, short_description, full_description, genres, steam_tags,
developer, publisher, release_date, platforms,
header_image (URL), capsule_image (URL),
review_score, review_count, top_reviews[], average_playtime
```

Rules:
- The database is the single source of truth — never hardcode game data into frontend components.
- Ingestion must be **idempotent**: re-running it upserts on `steam_appid`, never duplicates.
- Popularity selection for the initial ~1,000: sort by review_count / owned-players proxy from the storefront data, take the top N across a spread of genres so the map isn't dominated by one category.

---

## 5. Game Document & Embedding Pipeline

For every game, build one normalized text document (cleaned of HTML, boilerplate, review spam, duplicate whitespace) combining description, genres, Steam tags, and the top review excerpts — capped, not an unbounded concatenation.

```
Normalized Document → bge-small-en-v1.5 → 384-dim vector → pgvector
```

Store per row: `embedding`, `model`, `model_version`, `embedded_at`. A model/version change creates new rows or a new versioned column set — it never overwrites vectors from a different model version.

Similarity search (`findSimilarGames(gameId, limit)`) uses pgvector's cosine-distance operator directly in SQL; there is no LLM in this path.

---

## 6. Tagging Taxonomy

Stored as structured entities (`game_tags`, `game_tag_assignments` — not a comma-separated string), grouped by category:

| Category | Examples |
|---|---|
| Genre | RPG, Action, Adventure, Strategy, Simulation, Shooter, Racing, Platformer, Puzzle, Horror |
| Gameplay | Open World, Exploration, Crafting, Base Building, Stealth, Survival, Turn-Based, Real-Time Combat, Character Customization, Resource Management |
| Experience | Story-Rich, Difficult, Relaxing, Competitive, Atmospheric, Immersive, Casual, Challenging |
| Setting | Fantasy, Sci-Fi, Medieval, Cyberpunk, Post-Apocalyptic, Historical, Modern, Space, Horror |
| Player structure | Single Player, Multiplayer, Co-op, PvP, Local Multiplayer |

Tags are assigned from Steam's own tags where possible, with a `confidence` and `source` column so manually-inferred tags can be distinguished from Steam-sourced ones later.

---

## 7. Game Map

- UMAP runs **once, offline, in the pipeline** — never on page load, never per-request.
- Output `x`, `y`, `projection_version` stored per game in `game_coordinates`.
- Frontend fetches precomputed coordinates in one batch call (1,000 rows is small — no pagination needed for the base map; keep the query server-filtered when tag/genre/year/playtime filters are active so the client never has to load and filter all embeddings itself).
- Interactions: zoom, pan, hover (name, genre, top tags, review score, approx. playtime), click → detail panel, search-to-highlight, multi-select neighborhoods, filter by genre/tag/year/playtime.
- Selecting one or more games highlights that game (or set) plus its 5–10 nearest neighbors by cosine similarity, computed via the same pgvector query the detail panel uses.
- For a connected Steam user: recently played = strong highlight, owned-but-not-recent = muted/secondary, recommendations = distinct highlight color.

---

## 8. Game Detail Panel

Shows title, cover image (linked from Steam CDN), description, genres, semantic tags, Steam tags, review info, developer, publisher, release date, estimated playtime, and a "Similar games" list.

**"Why is this game here?"** — generated only from real similarity/tag data actually retrieved for that game (e.g., "close to X, Y, Z because of shared combat style, difficulty, and setting tags"). Never invent features or comparisons the data doesn't support.

---

## 9. Steam User Integration

- User optionally provides a Steam ID (or connects via Steam OpenID if you want a proper login later — OpenID is free, no key required beyond the Web API key for subsequent data calls).
- Server-side calls to `GetRecentlyPlayedGames` and `GetOwnedGames`; playtime via the same responses.
- Map returned Steam AppIDs to the local ~1,000-game dataset. A Steam game outside the current dataset must **not crash the app** — mark it unavailable and optionally queue its AppID for a future ingestion run.
- Handle gracefully: private profiles, invalid Steam IDs, Steam API outages/timeouts — the app must degrade to "no personalization" rather than error out.

---

## 10. User Preference Model

Weighted, not a flat average:
```
recent games      → higher weight
frequently played → higher weight
older, low-playtime games → lower weight
```
MVP: a weighted centroid of the user's game embeddings. Architecture should allow swapping this for a more advanced per-user model later without touching the rest of the pipeline (keep it behind a `buildUserPreferenceVector(userId)` function, not inlined everywhere it's used).

---

## 11. Recommendation Engine

`recommendGames(userId, options)` combines:

```
final_score =
    0.50 * semantic_similarity
  + 0.20 * tag_similarity
  + 0.10 * popularity
  + 0.10 * review_quality
  + 0.10 * preference_match
```

Weights live in one config object, not scattered through the codebase. The engine:
- Excludes/penalizes already-owned, already-played, or explicitly-disliked games.
- Applies metadata filters: max playtime, min review score, genre, platform, release year, single/multiplayer, difficulty tag.
- Handles the empty-candidate case explicitly (relax filters and say so, rather than returning nothing with no explanation).

---

## 12. Natural-Language Discovery

A chat interface that, **without calling any paid LLM**, does rule-based / lightweight-NLP slot extraction:

1. Extract game names mentioned (fuzzy-match against the `games` table by name).
2. Extract constraints (playtime numbers, "shorter"/"easier"/"relaxing"/"not an RPG"/"multiplayer", etc.) via a small pattern/keyword parser into a structured object:
```json
{
  "similar_to": ["Elden Ring"],
  "max_playtime_hours": 20,
  "exclude_genres": ["RPG"],
  "difficulty": "lower",
  "mode": null
}
```
3. Run the same vector + tag + metadata retrieval and ranking as §11.
4. Generate the explanation from the actual retrieved similarity/tag overlap — template-based, not hallucinated.

If `OLLAMA_BASE_URL` is set (local dev only), it may be used to phrase the extraction/explanation more fluently, but the structured-constraint parser and the ranking must work correctly with it entirely absent, since production has no LLM available.

---

## 13. Optional Enrichment: Game Length

Behind a `GameLengthProvider` interface so the data source is swappable and never a hard dependency:
```
main_story_hours, main_plus_extras_hours, completionist_hours, all_styles_hours
```
There is no official public HowLongToBeat API, and scraping it raises ToS concerns — do not build this as an assumed, always-on integration. Ship the interface and a no-op/manual-data implementation first; only wire up a real provider if you've separately confirmed you're allowed to use it.

---

## 14. Database Schema (Supabase / Postgres)

```
games(id, steam_appid, name, slug, description, genres, developer, publisher,
      release_date, header_image_url, capsule_image_url, review_score,
      review_count, average_playtime, created_at, updated_at)

game_tags(id, name, category)

game_tag_assignments(game_id, tag_id, confidence, source)

game_reviews(id, game_id, review_text, rating, playtime, review_score,
             source, created_at)

game_embeddings(game_id, embedding vector(384), model, model_version, created_at)

game_coordinates(game_id, x, y, projection_version)

profiles(id, steam_id, created_at, updated_at)

user_game_history(user_id, game_id, playtime, last_played, source)

recommendations(id, user_id, game_id, score, reason, created_at)
```
Only `header_image_url` / `capsule_image_url` are stored (Steam CDN URLs) — no image bytes ever touch Supabase Storage.

---

## 15. Security

- Row Level Security on everything user-specific: `profiles`, `user_game_history`, `recommendations` readable/writable only by their owning authenticated user.
- `games`, `game_tags`, `game_tag_assignments`, `game_reviews`, `game_coordinates` are public-read.
- `STEAM_API_KEY` and the Supabase **service-role** key are server-only env vars, never sent to the browser, never used from a Client Component.
- Always derive the user ID from the authenticated Supabase session — never trust a client-supplied user ID.
- Validate every external input (Zod schemas on Route Handlers/Server Actions) and every Steam API response before it touches the database.

---

## 16. UI

```
GameAtlas
  Explore · Game Map · Recommendations · My Games · Ask GameAtlas
```
Landing page: short pitch + "Explore Game Map" + "Connect Steam" CTAs. Dark, modern, game-discovery aesthetic — information density and fast map interaction over decorative animation. Game Map is the centerpiece.

---

## 17. Performance Rules

- Never compute embeddings or run UMAP in a request/response cycle — both are offline pipeline outputs only.
- Never fetch every game individually to render the map — one batched coordinates query.
- Server-side filtering for genre/tag/year/playtime; the browser should not need the full embedding set to filter.
- Similarity search always goes through pgvector in SQL, never "load all vectors into the browser and compute in JS."

---

## 18. Pipeline Commands

```bash
python -m pipeline.ingest    # pull ~1,000 games from Steam, upsert
python -m pipeline.clean     # normalize/clean text
python -m pipeline.reviews   # pull top N reviews per game
python -m pipeline.embed     # bge-small embeddings → pgvector
python -m pipeline.project   # UMAP → game_coordinates
python -m pipeline.tags      # assign structured tags
python -m pipeline.all       # runs the full sequence
```
Every stage upserts on a stable key (`steam_appid` / `game_id`) — running the pipeline twice must never create duplicates.

---

## 19. Environment Variables (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STEAM_API_KEY=

# Optional, local development only — production must run without these set
OLLAMA_BASE_URL=
OLLAMA_MODEL=
```
`.env*` stays in `.gitignore`; no real secret ever committed.

---

## 20. Project Structure

```
gameatlas/
├── app/
│   ├── page.tsx
│   ├── map/  games/  recommendations/  my-games/  ask/  api/
├── components/
│   ├── game-map/  game-card/  game-details/  recommendation/  filters/  ui/
├── lib/
│   ├── supabase/  steam/  recommendations/  embeddings/  games/
├── python/pipeline/
│   ├── ingest.py  clean.py  reviews.py  embed.py  project.py  tags.py
├── supabase/migrations/
├── scripts/
├── public/
├── SETUP.md  ARCHITECTURE.md  README.md  .env.example
```

---

## 21. Development Phases

1. **Foundation** — Next.js, TS, Tailwind, Supabase project + schema + RLS, auth, basic layout, Vercel deploy, daily keep-alive cron. No recommendation engine yet.
2. **Game Dataset** — ingest ~1,000 games, tags, reviews, normalized documents.
3. **Embeddings** — bge-small pipeline, pgvector storage, similarity search + tests that obviously-similar games actually retrieve as similar.
4. **Game Map** — UMAP projection, coordinates, interactive map (search/hover/click/filter). First real user-facing milestone.
5. **Recommendations** — Steam integration, user profile vector, ranking engine.
6. **Natural Language** — constraint parser, explanations, optional local-only Ollama hook.
7. **Polish** — loading/error/empty states, responsive design, performance pass, accessibility, security review, tests.

Do not start implementation before producing `ARCHITECTURE.md`, `SETUP.md`, and confirming the base app builds and deploys. Do not move to the next phase until the current one type-checks, passes its tests, and is documented.

---

## 22. Testing Checklist

- **Data**: duplicate games rejected; invalid AppIDs handled; missing description/reviews don't break the pipeline.
- **Embeddings**: every indexed game has a vector; dimensions consistent; similarity queries return sane results.
- **Recommendations**: owned/played exclusions work; playtime and genre filters work; empty candidate sets handled gracefully.
- **Steam**: invalid IDs, private profiles, missing games, and API failures/timeouts are all handled without crashing.
- **Frontend**: map renders all games; search, filters, detail panel, and recommendation cards all work.

---

## 23. Engineering Rules

- TypeScript, strict mode, no `any`.
- Validate every external API response (Zod).
- Secrets server-side only, via env vars, never committed.
- Migrations for all schema changes; RLS on every user-specific table.
- No hardcoded game data or recommendation weights in the frontend — the config object and the database are the sources of truth.
- Every external data provider (Steam, game-length, embedding model) sits behind an interface so it can be swapped without touching callers.
- Idempotent ingestion.
- The MVP must fully function with zero paid APIs and zero LLM calls in production.

---

## 24. First Task for Cursor

1. Inspect the repo.
2. Write `ARCHITECTURE.md`, `SETUP.md`, `README.md`.
3. Scaffold the project structure (§20).
4. Check what's already installed (Node, Python, Supabase CLI) — do not assume Stripe CLI is needed at all.
5. Write `.env.example`.
6. Write the initial Supabase migration (§14).
7. Get the app building and deploying to Vercel Hobby.
8. Confirm Phase 1 works end-to-end before touching Phase 2.

Never fabricate a credential — if one is required, document exactly how to obtain it in `SETUP.md` and use an env-var placeholder. Never substitute a paid service for a free/local one without asking first. When a free service has a real limitation (rate limit, storage cap, no official API), design around it explicitly rather than building an integration that will quietly break.

---

## 25. Definition of Done (MVP)

A user can: open GameAtlas → see the ~1,000-game interactive map → search, hover, click a game → see its metadata, tags, and similar games → filter the map → provide a Steam ID → see their recently played games highlighted → get personalized recommendations → ask "I played these three games, what next?" and "something under 20 hours" → get ranked, explained recommendations that exclude what they already own/play where requested — **all without any paid LLM API and within Supabase's and Vercel's free tiers.**
