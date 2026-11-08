-- climbcal — two more Luzon gyms: Hangar 8 and Climb Shack
--
-- Same shape as 20260929000000_grava_gym.sql: the seeded list is reference data
-- that arrives by migration (the rest is admin-curated from /admin, see
-- 20260920000200_gyms_admin_only.sql). `region` drives the session dropdown's
-- optgroups and the "where I climb" rollups, so it is spelled the same way as
-- the other Luzon rows.
--
-- These two already had brand colours in src/lib/gymColors.ts, and that palette
-- has to cover the seeded list exactly (src/lib/gymColors.test.ts), so the rows
-- belong here rather than only in someone's dashboard.
--
-- Idempotent: re-running refreshes the region instead of duplicating rows,
-- matching the `gyms_name_lower_key` unique index on `lower(btrim(name))`.

insert into public.gyms (name, region)
values
  ('Hangar 8', 'Luzon'),
  ('Climb Shack', 'Luzon')
on conflict ((lower(btrim(name)))) do update
  set region = excluded.region;
