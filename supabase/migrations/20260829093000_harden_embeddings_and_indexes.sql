-- Keep vectors outside the public API schema and index every non-leading
-- foreign key used by catalogue and recommendation lookups.

create schema if not exists private;
create schema if not exists extensions;
revoke all on schema private from public;
revoke all on schema extensions from public;

alter extension vector set schema extensions;
alter table public.game_embeddings set schema private;
alter table private.game_embeddings disable row level security;

create index game_reviews_game_id_idx on public.game_reviews(game_id);
create index game_tag_assignments_tag_id_idx on public.game_tag_assignments(tag_id);
create index recommendations_game_id_idx on public.recommendations(game_id);
create index user_game_history_game_id_idx on public.user_game_history(game_id);
