alter table public.games add column embedding_document text;
alter table public.game_reviews add column source_review_id text;

-- Keeps review ingestion idempotent. Deliberately not a partial index:
-- Postgres cannot infer a partial index for ON CONFLICT and PostgREST has no
-- way to supply the predicate, so every upsert would fail against one.
create unique index game_reviews_source_review_id_idx
  on public.game_reviews(game_id, source_review_id);
