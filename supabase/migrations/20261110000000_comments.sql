-- climbcal — comments: on a session, and on a climber's wall
--
-- Two flat threads, no replies:
--   * public.climb_comments   - one row per comment on a `climbs` session
--   * public.profile_comments - the "wall" (guestbook) on a `profiles` row
--
-- Visibility mirrors the thing being commented on, never the client:
--   * session comments are readable by whoever may read the session - its owner,
--     an accepted friend, or anyone while the owner's profile is public. That is
--     the same predicate as `climbs_select_visible`, kept in `can_view_climb` so
--     the two can never drift apart quietly;
--   * wall notes are readable by the wall owner, their accepted friends, and
--     anyone while the profile is public (`can_view_wall`).
--
-- Moderation is deliberately local: an author may delete their own comment, and
-- the owner of the session / wall may delete any comment on it. There is no
-- admin queue - the owner of the wall is the moderator.
--
-- The public share page (`/u/<username>`) is untouched: `shared_profile()` reads
-- neither table, so "time and gym only, never text" still holds for a visitor
-- without an account.
--
-- Idempotent: `create table if not exists`, `create or replace` for functions,
-- `drop policy if exists` before every policy, and grants that can be re-run.

-- --------------------------------------------------------------- tables ----

create table if not exists public.climb_comments (
  id uuid primary key default gen_random_uuid(),
  climb_id uuid not null references public.climbs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint climb_comments_body_length
    check (length(btrim(body)) between 1 and 280)
);

-- A thread is always read oldest-first for one session, so the index leads with
-- `climb_id` and keeps `created_at` beside it.
create index if not exists climb_comments_climb_idx
  on public.climb_comments (climb_id, created_at);
create index if not exists climb_comments_user_idx
  on public.climb_comments (user_id);

create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_comments_body_length
    check (length(btrim(body)) between 1 and 280)
);

create index if not exists profile_comments_profile_idx
  on public.profile_comments (profile_id, created_at);
create index if not exists profile_comments_user_idx
  on public.profile_comments (user_id);

-- ------------------------------------------------------------- helpers ----

-- Can the caller see this session? Mirrors `climbs_select_visible` in
-- 20260919000000_init.sql - change both together.
create or replace function public.can_view_climb(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.climbs c
    where c.id = target
      and (
        c.user_id = auth.uid()
        or public.are_friends(auth.uid(), c.user_id)
        or public.profile_is_public(c.user_id)
      )
  );
$$;

-- Can the caller see this climber's wall? Their own, a friend's, or a public
-- profile's - the same shape as the climb rule, applied to `profiles`.
create or replace function public.can_view_wall(target uuid)
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
      and (
        p.id = auth.uid()
        or p.visibility = 'public'
        or public.are_friends(auth.uid(), p.id)
      )
  );
$$;

-- An edit may change the text and nothing else: a comment cannot be reassigned
-- to another climber or moved onto another session / wall after it was written.
create or replace function public.enforce_comment_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'A comment cannot be reassigned to another climber';
  end if;

  if (to_jsonb(new) - 'body' - 'updated_at') <> (to_jsonb(old) - 'body' - 'updated_at') then
    raise exception 'A comment cannot be moved to another target';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- triggers ----

drop trigger if exists climb_comments_touch_updated_at on public.climb_comments;
create trigger climb_comments_touch_updated_at
  before update on public.climb_comments
  for each row execute function public.touch_updated_at();

drop trigger if exists climb_comments_enforce_update on public.climb_comments;
create trigger climb_comments_enforce_update
  before update on public.climb_comments
  for each row execute function public.enforce_comment_update();

drop trigger if exists profile_comments_touch_updated_at on public.profile_comments;
create trigger profile_comments_touch_updated_at
  before update on public.profile_comments
  for each row execute function public.touch_updated_at();

drop trigger if exists profile_comments_enforce_update on public.profile_comments;
create trigger profile_comments_enforce_update
  before update on public.profile_comments
  for each row execute function public.enforce_comment_update();

-- ------------------------------------------------------------------ RLS ----
-- No anonymous access: nothing here is granted to `anon`, so a session thread
-- and a wall stay inside the signed-in app.

alter table public.climb_comments enable row level security;
alter table public.profile_comments enable row level security;

-- Session comments: read where the session is readable, write as yourself.

drop policy if exists climb_comments_select_visible on public.climb_comments;
create policy climb_comments_select_visible on public.climb_comments
  for select to authenticated
  using (public.can_view_climb(climb_id));

drop policy if exists climb_comments_insert_visible on public.climb_comments;
create policy climb_comments_insert_visible on public.climb_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_climb(climb_id));

drop policy if exists climb_comments_update_own on public.climb_comments;
create policy climb_comments_update_own on public.climb_comments
  for update to authenticated
  using (user_id = auth.uid() and public.can_view_climb(climb_id))
  with check (user_id = auth.uid() and public.can_view_climb(climb_id));

-- The author, or the climber whose session it is (their wall, their call).
drop policy if exists climb_comments_delete_author_or_owner on public.climb_comments;
create policy climb_comments_delete_author_or_owner on public.climb_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.climbs c
      where c.id = climb_comments.climb_id
        and c.user_id = auth.uid()
    )
  );

-- Wall notes: read where the wall is readable, write as yourself.

drop policy if exists profile_comments_select_visible on public.profile_comments;
create policy profile_comments_select_visible on public.profile_comments
  for select to authenticated
  using (public.can_view_wall(profile_id));

drop policy if exists profile_comments_insert_visible on public.profile_comments;
create policy profile_comments_insert_visible on public.profile_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_wall(profile_id));

drop policy if exists profile_comments_update_own on public.profile_comments;
create policy profile_comments_update_own on public.profile_comments
  for update to authenticated
  using (user_id = auth.uid() and public.can_view_wall(profile_id))
  with check (user_id = auth.uid() and public.can_view_wall(profile_id));

-- The author, or the climber whose wall it is.
drop policy if exists profile_comments_delete_author_or_owner on public.profile_comments;
create policy profile_comments_delete_author_or_owner on public.profile_comments
  for delete to authenticated
  using (user_id = auth.uid() or profile_id = auth.uid());

-- --------------------------------------------------------------- grants ----

grant select, insert, update, delete
  on public.climb_comments, public.profile_comments
  to authenticated;

grant execute on function public.can_view_climb(uuid) to authenticated;
grant execute on function public.can_view_wall(uuid) to authenticated;

-- PostgREST keeps its own schema cache. Supabase reloads it on DDL through an
-- event trigger, but saying so explicitly makes the new tables queryable the
-- moment this migration finishes - the app was built against them already.
notify pgrst, 'reload schema';
