-- Let the offline pipeline read/write private.game_embeddings over the REST API.
-- These are pipeline-only: the service role is the sole grantee.

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
