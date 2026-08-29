-- 20230829120000_initial_schema.sql
-- Supabase initial schema for GameAtlas

-- Enable pgvector extension
create extension if not exists vector;

-- Games table (public read)
create table games (
  id bigint generated always as identity primary key,
  steam_appid integer not null unique,
  name text not null,
  slug text generated always as (replace(lower(name), ' ', '-')) stored,
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
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Game tags (public)
create table game_tags (
  id bigint generated always as identity primary key,
  name text not null unique,
  category text not null
);

-- Assignments of tags to games (public)
create table game_tag_assignments (
  game_id bigint references games(id) on delete cascade,
  tag_id bigint references game_tags(id) on delete cascade,
  confidence real not null,
  source text not null,
  primary key (game_id, tag_id)
);

-- Game reviews (public)
create table game_reviews (
  id bigint generated always as identity primary key,
  game_id bigint references games(id) on delete cascade,
  review_text text,
  rating integer,
  playtime integer,
  review_score integer,
  source text,
  created_at timestamp with time zone default now()
);

-- Embeddings (private, only server reads for similarity search)
create table game_embeddings (
  game_id bigint references games(id) on delete cascade,
  embedding vector(384) not null,
  model text not null,
  model_version text not null,
  created_at timestamp with time zone default now(),
  primary key (game_id, model, model_version)
);

-- Coordinates for map display
create table game_coordinates (
  game_id bigint references games(id) on delete cascade,
  x double precision not null,
  y double precision not null,
  projection_version text not null,
  primary key (game_id, projection_version)
);

-- Profiles (RLS-protected)
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  steam_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- User game history (RLS-protected)
create table user_game_history (
  user_id uuid references profiles(id) on delete cascade,
  game_id bigint references games(id) on delete cascade,
  playtime integer,
  last_played timestamp with time zone,
  source text,
  primary key (user_id, game_id)
);

-- Recommendations (RLS-protected)
create table recommendations (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  game_id bigint references games(id) on delete cascade,
  score real not null,
  reason text,
  created_at timestamp with time zone default now()
);

-- Row Level Security policies (example, adjust as needed)
alter table profiles enable row level security;
create policy "public select profiles" on profiles for select using (auth.uid() = id);
create policy "public insert profiles" on profiles for insert with check (auth.uid() = id);

alter table user_game_history enable row level security;
create policy "public select history" on user_game_history for select using (auth.uid() = user_id);
create policy "public insert history" on user_game_history for insert with check (auth.uid() = user_id);

alter table recommendations enable row level security;
create policy "public select recs" on recommendations for select using (auth.uid() = user_id);
create policy "public insert recs" on recommendations for insert with check (auth.uid() = user_id);
