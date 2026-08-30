-- GameAtlas initial schema. Public catalogue data is read-only; all user data
-- is scoped to the authenticated owner through RLS.

create extension if not exists vector;

create table public.games (
  id bigint generated always as identity primary key,
  steam_appid integer not null unique,
  name text not null,
  slug text generated always as (replace(lower(name), ' ', '-')) stored,
  description text, genres text[], developer text, publisher text,
  release_date date, header_image_url text, capsule_image_url text,
  review_score integer check (review_score between 0 and 100),
  review_count integer check (review_count >= 0),
  average_playtime integer check (average_playtime >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.game_tags (
  id bigint generated always as identity primary key, name text not null unique, category text not null
);
create table public.game_tag_assignments (
  game_id bigint not null references public.games(id) on delete cascade,
  tag_id bigint not null references public.game_tags(id) on delete cascade,
  confidence real not null check (confidence between 0 and 1), source text not null,
  primary key (game_id, tag_id)
);
create table public.game_reviews (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games(id) on delete cascade,
  review_text text, rating integer, playtime integer check (playtime >= 0),
  review_score integer, source text, created_at timestamptz not null default now()
);
-- The API roles are never granted this table; pipeline/server code accesses it only with privileged DB credentials.
create table public.game_embeddings (
  game_id bigint not null references public.games(id) on delete cascade,
  embedding vector(384) not null, model text not null, model_version text not null,
  created_at timestamptz not null default now(), primary key (game_id, model, model_version)
);
create index game_embeddings_cosine_idx on public.game_embeddings using hnsw (embedding vector_cosine_ops);
create table public.game_coordinates (
  game_id bigint not null references public.games(id) on delete cascade,
  x double precision not null, y double precision not null, projection_version text not null,
  primary key (game_id, projection_version)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  steam_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_game_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  playtime integer check (playtime >= 0), last_played timestamptz, source text not null,
  primary key (user_id, game_id)
);
create table public.recommendations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  score real not null, reason text, created_at timestamptz not null default now(), unique (user_id, game_id)
);

alter table public.games enable row level security;
alter table public.game_tags enable row level security;
alter table public.game_tag_assignments enable row level security;
alter table public.game_reviews enable row level security;
alter table public.game_embeddings enable row level security;
alter table public.game_coordinates enable row level security;
alter table public.profiles enable row level security;
alter table public.user_game_history enable row level security;
alter table public.recommendations enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.games, public.game_tags, public.game_tag_assignments, public.game_reviews, public.game_coordinates to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.user_game_history, public.recommendations to authenticated;

create policy "public can read games" on public.games for select to anon, authenticated using (true);
create policy "public can read game tags" on public.game_tags for select to anon, authenticated using (true);
create policy "public can read tag assignments" on public.game_tag_assignments for select to anon, authenticated using (true);
create policy "public can read game reviews" on public.game_reviews for select to anon, authenticated using (true);
create policy "public can read coordinates" on public.game_coordinates for select to anon, authenticated using (true);
create policy "users read their profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users create their profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "users update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "users read their history" on public.user_game_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "users add their history" on public.user_game_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update their history" on public.user_game_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users remove their history" on public.user_game_history for delete to authenticated using ((select auth.uid()) = user_id);
create policy "users read their recommendations" on public.recommendations for select to authenticated using ((select auth.uid()) = user_id);

create index user_game_history_user_id_idx on public.user_game_history(user_id);
create index recommendations_user_id_idx on public.recommendations(user_id);
