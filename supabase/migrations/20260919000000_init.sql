-- climbcal — initial schema
-- Apply with the Supabase CLI (`supabase db push`) or paste into the
-- SQL editor of your Supabase project (Dashboard → SQL → New query).

-- ---------------------------------------------------------------- types ----

do $$
begin
  if not exists (select 1 from pg_type where typname = 'visibility') then
    create type public.visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'friendship_status') then
    create type public.friendship_status as enum ('pending', 'accepted');
  end if;
end
$$;

-- --------------------------------------------------------------- tables ----

-- One row per auth user, created by the on-signup trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$')
);

create index if not exists profiles_username_idx on public.profiles (lower(username));

-- Shared gym list: seeded rows (0002) plus user-created ones.
create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gyms_name_not_blank check (length(btrim(name)) > 0)
);

-- Case-insensitive uniqueness so "Vertical Hub" cannot be added twice.
create unique index if not exists gyms_name_lower_key
  on public.gyms (lower(btrim(name)));

-- A climbing session: one row per user / day / time window.
create table if not exists public.climbs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  climb_date date not null,
  start_time time not null,
  end_time time not null,
  gym_id uuid references public.gyms (id) on delete set null,
  custom_gym_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint climbs_time_order check (end_time > start_time),
  constraint climbs_gym_present check (
    gym_id is not null
    or (custom_gym_name is not null and length(btrim(custom_gym_name)) > 0)
  ),
  constraint climbs_note_length check (note is null or length(note) <= 280)
);

create index if not exists climbs_date_idx on public.climbs (climb_date);
create index if not exists climbs_user_idx on public.climbs (user_id);
create index if not exists climbs_user_date_idx on public.climbs (user_id, climb_date);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- One row per pair, regardless of direction: A→B and B→A can never both exist.
create unique index if not exists friendships_pair_key
  on public.friendships (
    (least(requester_id, addressee_id)),
    (greatest(requester_id, addressee_id))
  );

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ------------------------------------------------------------ functions ----

-- Keeps updated_at honest without server code.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Creates a private profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Friendship transitions: participants are immutable and only the addressee
-- may accept. Everything else (decline, unfriend) is a plain delete.
create or replace function public.enforce_friendship_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friendship participants cannot be changed';
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' and auth.uid() <> old.addressee_id then
    raise exception 'Only the addressee can accept a friend request';
  end if;

  return new;
end;
$$;

-- Accepted-friend check. SECURITY DEFINER so RLS on friendships does not
-- recurse when it is used inside the climbs policy.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

-- True when the profile chose `visibility = 'public'`.
create or replace function public.profile_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target
      and p.visibility = 'public'
  );
$$;

-- ------------------------------------------------------------- triggers ----

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists climbs_touch_updated_at on public.climbs;
create trigger climbs_touch_updated_at
  before update on public.climbs
  for each row execute function public.touch_updated_at();

drop trigger if exists friendships_touch_updated_at on public.friendships;
create trigger friendships_touch_updated_at
  before update on public.friendships
  for each row execute function public.touch_updated_at();

drop trigger if exists friendships_enforce_update on public.friendships;
create trigger friendships_enforce_update
  before update on public.friendships
  for each row execute function public.enforce_friendship_update();

-- auth.users is owned by Supabase; this trigger runs as the definer.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ RLS ----

alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.climbs enable row level security;
alter table public.friendships enable row level security;

-- profiles: readable by any signed-in climber (needed for search + feed
-- attribution); only the owner can insert/update their own row.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- gyms: shared list; anyone signed in may add one, only the creator may edit.
drop policy if exists gyms_select_authenticated on public.gyms;
create policy gyms_select_authenticated on public.gyms
  for select to authenticated
  using (true);

drop policy if exists gyms_insert_own on public.gyms;
create policy gyms_insert_own on public.gyms
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists gyms_update_own on public.gyms;
create policy gyms_update_own on public.gyms
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists gyms_delete_own on public.gyms;
create policy gyms_delete_own on public.gyms
  for delete to authenticated
  using (created_by = auth.uid());

-- climbs: owner, accepted friends, or anyone when the owner is public.
-- Writes are always owner-only.
drop policy if exists climbs_select_visible on public.climbs;
create policy climbs_select_visible on public.climbs
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
    or public.profile_is_public(user_id)
  );

drop policy if exists climbs_insert_own on public.climbs;
create policy climbs_insert_own on public.climbs
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists climbs_update_own on public.climbs;
create policy climbs_update_own on public.climbs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists climbs_delete_own on public.climbs;
create policy climbs_delete_own on public.climbs
  for delete to authenticated
  using (user_id = auth.uid());

-- friendships: only the two participants can see the row. Either side can
-- cancel/decline (delete); only the addressee can flip status to accepted
-- (enforced by the friendships_enforce_update trigger).
drop policy if exists friendships_select_involved on public.friendships;
create policy friendships_select_involved on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_insert_own_request on public.friendships;
create policy friendships_insert_own_request on public.friendships
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and addressee_id <> auth.uid()
    and status = 'pending'
  );

drop policy if exists friendships_update_involved on public.friendships;
create policy friendships_update_involved on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_delete_involved on public.friendships;
create policy friendships_delete_involved on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- --------------------------------------------------------------- grants ----

-- No anonymous browsing: nothing is granted to `anon`.
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.gyms, public.climbs, public.friendships
  to authenticated;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.profile_is_public(uuid) to authenticated;
