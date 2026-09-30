-- climbcal — one more Luzon gym: Grava
--
-- The gym list is admin-curated reference data (see
-- 20260920000200_gyms_admin_only.sql), so a new gym arrives either from the
-- /admin dashboard or, for the seeded list, as a migration like this one.
-- `region` drives the session dropdown's optgroups and the "where I climb"
-- rollups, so it has to be spelled the same way as the rest of the Luzon rows.
--
-- Idempotent: re-running refreshes the region instead of duplicating the row,
-- matching the `gyms_name_lower_key` unique index on `lower(btrim(name))`.

insert into public.gyms (name, region)
values ('Grava', 'Luzon')
on conflict ((lower(btrim(name)))) do update
  set region = excluded.region;
