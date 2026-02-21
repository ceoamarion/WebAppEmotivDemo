*/ script 1 - profile table /*
-- Create a table for public profiles linked to auth.users
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,

  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
  
*/ script 2 - Update handle_new_user to include username and website /*
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username, website)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'website'
  );
  return new;
end;
$$ language plpgsql security definer;

*/ script 3 - Backfill existing profiles with username and website from auth metadata /*
update public.profiles p
set
  username = u.raw_user_meta_data->>'username',
  website  = u.raw_user_meta_data->>'website',
  full_name = coalesce(p.full_name, u.raw_user_meta_data->>'full_name'),
  updated_at = now()
from auth.users u
where p.id = u.id
  and (p.username is null or p.website is null);

-- ============================================================
-- Script 4 - Sessions tables with RLS
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Sessions table
create table if not exists public.sessions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete cascade not null,
  started_at             timestamptz not null,
  ended_at               timestamptz not null,
  duration_sec           int not null,
  best_state             text not null,
  best_state_duration_sec int not null default 0,
  avg_eeg_quality        numeric,
  avg_valence            numeric not null default 0,
  avg_arousal            numeric not null default 0,
  avg_control            numeric not null default 0,
  notes                  text,
  created_at             timestamptz default now()
);

alter table public.sessions enable row level security;

create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- State segments table
create table if not exists public.session_state_segments (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references public.sessions(id) on delete cascade not null,
  state_name     text not null,
  tier           text not null,
  started_at     timestamptz not null,
  ended_at       timestamptz not null,
  duration_sec   int not null,
  avg_confidence numeric not null default 0
);

alter table public.session_state_segments enable row level security;

create policy "Users can view own segments"
  on public.session_state_segments for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert own segments"
  on public.session_state_segments for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );