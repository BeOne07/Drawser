-- Drawser Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    avatar_url text,
    total_score integer not null default 0,
    games_played integer not null default 0,
    wins integer not null default 0,
    created_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    base_username text;
    fallback_username text;
begin
    base_username := lower(
        regexp_replace(
            coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'player'),
            '[^a-z0-9_]',
            '_',
            'g'
        )
    );
    base_username := regexp_replace(base_username, '_+', '_', 'g');
    base_username := trim(both '_' from base_username);
    if base_username = '' then
        base_username := 'player';
    end if;
    base_username := left(base_username, 24);

    begin
        insert into public.profiles (id, username, avatar_url)
        values (new.id, base_username, null)
        on conflict (id) do nothing;
    exception when unique_violation then
        fallback_username := left(base_username || '_' || substring(replace(new.id::text, '-', '') from 1 for 6), 24);
        insert into public.profiles (id, username, avatar_url)
        values (new.id, fallback_username, null)
        on conflict (id) do nothing;
    end;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user_profile();

create table if not exists public.rooms (
    id text primary key,
    host_id uuid references public.profiles(id) on delete set null,
    settings jsonb not null default '{}'::jsonb,
    status text not null default 'waiting',
    created_at timestamptz not null default now(),
    constraint rooms_status_check check (status in ('waiting', 'playing', 'ended'))
);

create table if not exists public.words (
    id bigserial primary key,
    word text not null unique,
    difficulty text not null default 'medium',
    category text not null default 'general',
    created_at timestamptz not null default now(),
    constraint words_difficulty_check check (difficulty in ('easy', 'medium', 'hard'))
);

create table if not exists public.game_sessions (
    id uuid primary key default gen_random_uuid(),
    room_id text references public.rooms(id) on delete set null,
    winner_id uuid references public.profiles(id) on delete set null,
    ended_at timestamptz not null default now()
);

create index if not exists idx_words_difficulty on public.words (difficulty);
create index if not exists idx_profiles_total_score on public.profiles (total_score desc);
create index if not exists idx_game_sessions_winner_id on public.game_sessions (winner_id);

-- RPC helper for random words.
create or replace function public.get_random_words(
    count_param integer default 3,
    difficulty_param text default null
)
returns table(word text)
language sql
security definer
as $$
    select w.word
    from public.words w
    where difficulty_param is null or w.difficulty = difficulty_param
    order by random()
    limit greatest(1, least(count_param, 20));
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.words enable row level security;
alter table public.game_sessions enable row level security;

-- profiles
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
    on public.profiles for select
    using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
    on public.profiles for insert
    with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- rooms
drop policy if exists "rooms_select_all" on public.rooms;
create policy "rooms_select_all"
    on public.rooms for select
    using (true);

drop policy if exists "rooms_mutation_host" on public.rooms;
create policy "rooms_mutation_host"
    on public.rooms for all
    using (auth.uid() = host_id)
    with check (auth.uid() = host_id);

-- words
drop policy if exists "words_select_all" on public.words;
create policy "words_select_all"
    on public.words for select
    using (true);

-- game_sessions
drop policy if exists "sessions_select_all" on public.game_sessions;
create policy "sessions_select_all"
    on public.game_sessions for select
    using (true);

drop policy if exists "sessions_insert_auth" on public.game_sessions;
create policy "sessions_insert_auth"
    on public.game_sessions for insert
    with check (auth.uid() is not null);
