-- ============================================================================
-- GameAtlas — pending migrations, combined.
--
-- Your Supabase project currently has ONLY 20230829120000_initial_schema.sql
-- applied. This file applies the remaining four migrations, in order:
--
--   20260829093000_harden_embeddings_and_indexes.sql
--   20260829100000_pipeline_support.sql
--   20260829120000_map_filters_and_similarity_rpcs.sql
--   20260830120000_pipeline_rpcs.sql
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste all of
-- this -> Run. It is idempotent, so re-running it is safe.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Harden embeddings + index every non-leading foreign key
-- ---------------------------------------------------------------------------

create schema if not exists private;
create schema if not exists extensions;
revoke all on schema private from public;
revoke all on schema extensions from public;

-- Move pgvector out of public, unless it already lives elsewhere.
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector' and n.nspname = 'public'
  ) then
    execute 'alter extension vector set schema extensions';
  end if;
end
$$;

-- Vectors must never be reachable through the REST API schema.
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'game_embeddings'
  ) then
    execute 'alter table public.game_embeddings set schema private';
  end if;
end
$$;

alter table private.game_embeddings disable row level security;

create index if not exists game_reviews_game_id_idx on public.game_reviews(game_id);
create index if not exists game_tag_assignments_tag_id_idx on public.game_tag_assignments(tag_id);
create index if not exists recommendations_game_id_idx on public.recommendations(game_id);
create index if not exists user_game_history_game_id_idx on public.user_game_history(game_id);


-- ---------------------------------------------------------------------------
-- 2. Pipeline support columns
-- ---------------------------------------------------------------------------

alter table public.games add column if not exists embedding_document text;
alter table public.game_reviews add column if not exists source_review_id text;

-- Makes review ingestion idempotent on re-runs. Deliberately NOT a partial
-- index: Postgres cannot infer a partial index for ON CONFLICT, and PostgREST
-- has no way to supply the predicate, so every upsert would fail.
drop index if exists public.game_reviews_source_review_id_idx;
create unique index if not exists game_reviews_source_review_id_idx
  on public.game_reviews(game_id, source_review_id);


-- ---------------------------------------------------------------------------
-- 3. Map filter columns + similarity RPCs
--
-- The app reaches private.game_embeddings only through these security-definer
-- functions, so raw vectors are never exposed over the API.
-- ---------------------------------------------------------------------------

alter table public.games add column if not exists platforms text[];
alter table public.games add column if not exists steam_tags text[];

create or replace function public.find_similar_games(p_game_id bigint, p_limit integer default 8)
returns table (
  id bigint,
  name text,
  steam_appid integer,
  header_image_url text,
  genres text[],
  review_score integer,
  distance double precision
)
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select g.id,
         g.name,
         g.steam_appid,
         g.header_image_url,
         g.genres,
         g.review_score,
         (e.embedding <=> src.embedding)::double precision as distance
  from private.game_embeddings src
  join private.game_embeddings e
    on e.model = src.model
   and e.model_version = src.model_version
   and e.game_id <> src.game_id
  join public.games g on g.id = e.game_id
  where src.game_id = p_game_id
  order by e.embedding <=> src.embedding
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;

create or replace function public.embedding_centroid(p_game_ids bigint[])
returns text
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select avg(e.embedding)::text
  from private.game_embeddings e
  where e.game_id = any(p_game_ids);
$$;

create or replace function public.match_games(
  p_embedding text,
  p_exclude bigint[] default '{}'::bigint[],
  p_limit integer default 40
)
returns table (
  id bigint,
  name text,
  steam_appid integer,
  description text,
  genres text[],
  developer text,
  publisher text,
  release_date date,
  header_image_url text,
  capsule_image_url text,
  review_score integer,
  review_count integer,
  average_playtime integer,
  platforms text[],
  steam_tags text[],
  similarity double precision
)
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select g.id,
         g.name,
         g.steam_appid,
         g.description,
         g.genres,
         g.developer,
         g.publisher,
         g.release_date,
         g.header_image_url,
         g.capsule_image_url,
         g.review_score,
         g.review_count,
         g.average_playtime,
         g.platforms,
         g.steam_tags,
         (1 - (e.embedding <=> p_embedding::vector))::double precision as similarity
  from private.game_embeddings e
  join public.games g on g.id = e.game_id
  where not (g.id = any(coalesce(p_exclude, '{}'::bigint[])))
  order by e.embedding <=> p_embedding::vector
  limit greatest(1, least(coalesce(p_limit, 40), 80));
$$;

revoke all on function public.find_similar_games(bigint, integer) from public;
revoke all on function public.embedding_centroid(bigint[]) from public;
revoke all on function public.match_games(text, bigint[], integer) from public;

grant execute on function public.find_similar_games(bigint, integer) to anon, authenticated;
grant execute on function public.embedding_centroid(bigint[]) to anon, authenticated;
grant execute on function public.match_games(text, bigint[], integer) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Pipeline-only embedding read/write RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Drop older int-typed signatures if a previous version of this file ran.
drop function if exists public.upsert_embedding(int, vector, text, text);
drop function if exists public.get_embeddings(text, text);

create or replace function public.upsert_embedding(
  p_game_id bigint,
  p_embedding text,
  p_model text,
  p_model_version text
) returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  insert into private.game_embeddings (game_id, embedding, model, model_version)
  values (p_game_id, p_embedding::vector, p_model, p_model_version)
  on conflict (game_id, model, model_version) do update set
    embedding = excluded.embedding,
    created_at = now();
end;
$$;

create or replace function public.get_embeddings(
  p_model text,
  p_model_version text
) returns table (game_id bigint, embedding text)
language sql
stable
security definer
set search_path = public, private, extensions
as $$
  select e.game_id, e.embedding::text
  from private.game_embeddings e
  where e.model = p_model and e.model_version = p_model_version
  order by e.game_id;
$$;

revoke all on function public.upsert_embedding(bigint, text, text, text) from public;
revoke all on function public.get_embeddings(text, text) from public;
grant execute on function public.upsert_embedding(bigint, text, text, text) to service_role;
grant execute on function public.get_embeddings(text, text) to service_role;
