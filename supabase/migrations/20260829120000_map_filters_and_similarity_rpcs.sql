-- Catalogue fields the pipeline needs, plus security-definer RPCs so the
-- Next.js app can search private.game_embeddings without exposing vectors.

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
