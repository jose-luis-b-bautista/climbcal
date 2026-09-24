-- climbcal — public profile share links (`/u/<username>`)
--
-- A shared link has to open for someone who has **no account**, which is the one
-- thing the schema deliberately refused: `20260919000000_init.sql` grants nothing
-- to `anon` ("no anonymous browsing"). Opening `profiles` and `climbs` to
-- anonymous reads would fix that by handing the whole table to anyone with a
-- browser, notes included, so this migration adds one narrow door instead:
--
--   public.shared_profile(p_username text, p_week_start date) -> jsonb | null
--
-- It is `security definer` (so it reads past RLS) and answers only:
--   * for a profile whose `visibility = 'public'`, matched on `lower(username)`;
--   * with that climber's sessions for one Monday–Sunday week;
--   * with the session **note left out** — a note is written for friends, and the
--     shared snapshot stays what the app is about ("who is climbing, where, and
--     when"). Time + gym only.
--
-- `null` means "no public profile with that username". A private profile and a
-- typo give the same answer on purpose, so a share link cannot be used to probe
-- whether an account exists.
--
-- Note the order of the week: Postgres weeks start on Monday (`date_trunc('week')`),
-- which is what `lib/date.startOfWeek` does in the app. `p_week_start` comes from
-- the client so a shared link and the calendar agree on "this week" across
-- timezones; it falls back to the server's current week when omitted.
--
-- Idempotent: `create or replace` plus grants that can be re-run.
--
-- Validated against a local Postgres with a stubbed `auth` schema: a public
-- profile answers, a private one and an unknown username both answer `null`, the
-- note column never appears in the payload, and the week window is `[start, start+7)`.

create or replace function public.shared_profile(
  p_username text,
  p_week_start date default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with target as (
    select p.id, p.username, p.display_name, p.visibility, p.created_at, p.updated_at
    from public.profiles p
    where p.username is not null
      and lower(p.username) = lower(btrim(coalesce(p_username, '')))
      and p.visibility = 'public'
  ),
  week as (
    -- A Monday: the client's local week when it sent one, else this week.
    select coalesce(p_week_start, date_trunc('week', current_date)::date) as week_start
  )
  select case
    when not exists (select 1 from target) then null
    else jsonb_build_object(
      'profile', (select to_jsonb(t) from target t),
      'week_start', (select week_start from week),
      'sessions', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'climb_date', c.climb_date,
              'start_time', c.start_time,
              'end_time', c.end_time,
              'start_slot', c.start_slot,
              'end_slot', c.end_slot,
              -- A listed gym, else the name typed on the session. Never blank.
              'gym_name', coalesce(g1.name, nullif(btrim(c.custom_gym_name), '')),
              'gym_name_2', coalesce(g2.name, nullif(btrim(c.custom_gym_name_2), ''))
            )
            order by c.climb_date, c.start_time nulls last, c.start_slot nulls last
          )
          from public.climbs c
          left join public.gyms g1 on g1.id = c.gym_id
          left join public.gyms g2 on g2.id = c.gym_id_2
          cross join week w
          where c.user_id = (select id from target)
            and c.climb_date >= w.week_start
            and c.climb_date < w.week_start + 7
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

comment on function public.shared_profile(text, date) is
  'Public face of one climber''s week for a /u/<username> share link: public profiles only, session notes stripped, null when the username is unknown or private.';

-- `anon` is the point of a share link, so it may execute this function — and
-- only this function. No table privilege changes: `profiles` and `climbs` stay
-- unreadable to anonymous visitors, notes included (they are not in the payload
-- either). Supabase grants schema usage to `anon` by default; it is stated here
-- so the exception to "nothing is granted to anon" is visible in one place.
grant usage on schema public to anon;
grant execute on function public.shared_profile(text, date) to anon, authenticated;
