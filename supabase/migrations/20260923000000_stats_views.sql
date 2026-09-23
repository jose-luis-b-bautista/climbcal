-- climbcal — stats views (v1)
--
-- Read-only rollups for a climber stats page: a headline card row, a daily
-- activity heatmap, and a "where I climb" breakdown.
--
--   climb_sessions          one row per climb, window normalised to one scale
--   climb_gyms              one row per climb per named gym (both slots)
--   climber_daily_activity  per climber per day — the heatmap
--   climber_totals          per climber headline numbers
--   climber_gym_stats       per climber per gym — the breakdown
--
-- Plain views, no materialization: the existing `climbs (user_id, climb_date)`
-- index already covers these scans at this scale.
--
-- Every view is `security_invoker`, so the reader's own RLS on `climbs` applies
-- (owner, accepted friend, or a public profile — 20260919000000_init.sql).
-- Without it a view owned by the table owner would hand every climber every row.
-- That option is Postgres 15+ syntax and the linked project is 17.6.
--
-- `public.window_minutes(time, text)` (20260920000100_session_windows.sql) is
-- what makes a single duration column possible for clock times, slot labels and
-- mixed windows alike. For a slot label the duration is *notional* — "Closing"
-- means whatever the gym means by it — so `is_exact_window` marks the rows whose
-- duration is a real clock reading. Only show `duration_minutes` for those.
--
-- Idempotent: the views are dropped in dependency order first, so editing a
-- column list here and re-running `supabase db push` works.
--
-- The pair of labels that also live in the app — 'Not sure yet' (lib/format.ts
-- `gymNameOf`) and 'Other' (`OTHER_REGION_LABEL`) — are checked against these
-- files by `src/lib/statsViews.test.ts`.

-- ------------------------------------------------------------- indexes ------

-- `climbs` references `gyms` twice; both sides are joined by `climb_gyms`.
create index if not exists climbs_gym_id_idx on public.climbs (gym_id);
create index if not exists climbs_gym_id_2_idx on public.climbs (gym_id_2);

-- --------------------------------------------------------------- views ------

-- Dependency order: dependents first, so a re-run never trips over a view that
-- is still referenced.
drop view if exists public.climber_gym_stats;
drop view if exists public.climber_totals;
drop view if exists public.climber_daily_activity;
drop view if exists public.climb_gyms;
drop view if exists public.climb_sessions;

-- One row per climb, with the flexible window flattened onto the canonical
-- minutes-past-midnight scale used for ordering in SQL.
create or replace view public.climb_sessions
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.climb_date,
  -- Monday of the week, matching lib/date.startOfWeek (Postgres weeks start Mon).
  date_trunc('week', c.climb_date)::date as week_start,
  -- 1 = Monday … 7 = Sunday, matching DAY_NAMES_SHORT order.
  extract(isodow from c.climb_date)::int as iso_dow,
  c.start_time,
  c.end_time,
  c.start_slot,
  c.end_slot,
  public.window_minutes(c.start_time, c.start_slot) as start_minutes,
  public.window_minutes(c.end_time, c.end_slot) as end_minutes,
  public.window_minutes(c.end_time, c.end_slot)
    - public.window_minutes(c.start_time, c.start_slot) as duration_minutes,
  -- Both ends are clock times, so the duration above is a real reading.
  (c.start_time is not null and c.end_time is not null) as is_exact_window,
  (c.note is not null) as has_note,
  c.created_at,
  c.updated_at
from public.climbs c;

comment on view public.climb_sessions is
  'One row per climb with the session window normalised (duration_minutes is notional unless is_exact_window).';

-- One row per climb per *named* gym, so a session listing two gyms ("Either X or
-- Y") counts under both — the same rule the feed's `groupByGym` uses. A session
-- that named nothing at all still gets one synthetic row under 'Not sure yet',
-- flagged `is_named_gym = false`, so per-gym counts add back up to the session
-- total instead of silently dropping those rows.
create or replace view public.climb_gyms
with (security_invoker = true) as
with slots as (
  select
    c.id as climb_id,
    c.user_id,
    c.climb_date,
    1 as slot,
    c.gym_id,
    c.custom_gym_name
  from public.climbs c

  union all

  select
    c.id,
    c.user_id,
    c.climb_date,
    2,
    c.gym_id_2,
    c.custom_gym_name_2
  from public.climbs c
)
select
  s.climb_id,
  s.user_id,
  s.climb_date,
  s.slot,
  s.gym_id,
  -- A linked gym wins; otherwise the typed one-off name (trimmed). The shape
  -- constraint forbids both being set on one slot.
  coalesce(g.name, btrim(s.custom_gym_name)) as gym_name,
  g.region,
  true as is_named_gym
from slots s
left join public.gyms g on g.id = s.gym_id
-- The empty slot of a one-gym session, and both slots of "not sure yet".
where g.id is not null or btrim(s.custom_gym_name) <> ''

union all

select
  c.id,
  c.user_id,
  c.climb_date,
  1,
  null::uuid,
  'Not sure yet',
  null::text,
  false
from public.climbs c
where c.gym_id is null
  and c.custom_gym_name is null
  and c.gym_id_2 is null
  and c.custom_gym_name_2 is null;

comment on view public.climb_gyms is
  'One row per climb per named gym (both slots); unnamed sessions get a synthetic "Not sure yet" row with is_named_gym = false.';

-- The heatmap grain: one row per climber per day. `sessions` counts plans (two
-- sessions in one day count twice) while the day itself counts once.
create or replace view public.climber_daily_activity
with (security_invoker = true) as
select
  user_id,
  climb_date,
  week_start,
  iso_dow,
  count(*) as sessions,
  count(*) filter (where is_exact_window) as exact_sessions,
  sum(duration_minutes) as duration_minutes,
  coalesce(sum(duration_minutes) filter (where is_exact_window), 0) as exact_minutes,
  count(*) filter (where has_note) as notes
from public.climb_sessions
group by user_id, climb_date, week_start, iso_dow;

comment on view public.climber_daily_activity is
  'One row per climber per day with a session: heatmap counts, plus exact (clock-time) minutes.';

-- The headline card row. Future sessions are the norm here — a climb row is a
-- plan — so past and upcoming are counted separately: a "total" that mixed them
-- would move every time somebody posted next week's session.
create or replace view public.climber_totals
with (security_invoker = true) as
with totals as (
  select
    user_id,
    count(*) as sessions,
    count(*) filter (where climb_date <= current_date) as sessions_past,
    count(*) filter (where climb_date > current_date) as sessions_upcoming,
    count(distinct climb_date) as active_days,
    count(distinct week_start) as active_weeks,
    count(distinct date_trunc('month', climb_date)::date) as active_months,
    min(climb_date) filter (where climb_date <= current_date) as first_session,
    max(climb_date) filter (where climb_date <= current_date) as last_session,
    -- Durations are past-only too, so the card row's minutes describe climbing
    -- that happened rather than climbing that is merely planned.
    coalesce(
      sum(duration_minutes) filter (where is_exact_window and climb_date <= current_date),
      0
    ) as exact_minutes,
    round(avg(duration_minutes) filter (where is_exact_window and climb_date <= current_date))
      as avg_exact_minutes,
    coalesce(
      sum(duration_minutes) filter (where is_exact_window and climb_date > current_date),
      0
    ) as exact_minutes_upcoming,
    count(*) filter (where has_note) as sessions_with_note
  from public.climb_sessions
  group by user_id
),
gyms as (
  -- Named gyms only: the synthetic 'Not sure yet' row is not a gym visited.
  select
    user_id,
    count(distinct gym_name) as gyms_visited,
    count(distinct region) filter (where region is not null) as regions_visited
  from public.climb_gyms
  where is_named_gym
  group by user_id
)
select
  t.user_id,
  t.sessions,
  t.sessions_past,
  t.sessions_upcoming,
  t.active_days,
  t.active_weeks,
  t.active_months,
  t.first_session,
  t.last_session,
  t.exact_minutes,
  t.avg_exact_minutes,
  t.exact_minutes_upcoming,
  t.sessions_with_note,
  coalesce(g.gyms_visited, 0) as gyms_visited,
  coalesce(g.regions_visited, 0) as regions_visited
from totals t
left join gyms g on g.user_id = t.user_id;

comment on view public.climber_totals is
  'Per-climber headline numbers, past and upcoming split at current_date; minute totals are past-only and count exact clock windows.';

-- The "where I climb" breakdown. Grain is (climber, gym, region): a gym the user
-- typed by hand has no region, so it lands in the 'Other' bucket, the same label
-- `format.ts` uses for untagged gyms. Rows with `is_named_gym = false` are the
-- 'Not sure yet' bucket — keep them so the breakdown sums to `climber_totals.sessions`,
-- hide them if the chart is only about gyms.
--
-- Durations are joined from `climb_sessions`, and a two-gym session contributes
-- its minutes to each of its gym rows: the breakdown answers "time logged against
-- this gym", not "minutes that belong to it alone".
create or replace view public.climber_gym_stats
with (security_invoker = true) as
select
  cg.user_id,
  cg.gym_name,
  coalesce(nullif(btrim(cg.region), ''), 'Other') as region,
  cg.is_named_gym,
  count(distinct cg.climb_id) as sessions,
  count(distinct cg.climb_date) as days,
  min(cg.climb_date) as first_visit,
  max(cg.climb_date) as last_visit,
  sum(cs.duration_minutes) as duration_minutes,
  coalesce(sum(cs.duration_minutes) filter (where cs.is_exact_window), 0) as exact_minutes
from public.climb_gyms cg
join public.climb_sessions cs on cs.id = cg.climb_id
group by
  cg.user_id,
  cg.gym_name,
  cg.is_named_gym,
  coalesce(nullif(btrim(cg.region), ''), 'Other');

comment on view public.climber_gym_stats is
  'Per climber per gym: sessions, days, first/last visit and minutes (climbs with no gym keep a "Not sure yet" row).';

-- -------------------------------------------------------------- grants ------

-- The init grants are table-specific, so the views are granted explicitly.
-- Policies still decide which rows come back: these views are `security_invoker`.
grant select on public.climb_sessions to authenticated;
grant select on public.climb_gyms to authenticated;
grant select on public.climber_daily_activity to authenticated;
grant select on public.climber_totals to authenticated;
grant select on public.climber_gym_stats to authenticated;
