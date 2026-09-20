-- climbcal — starter gym list (placeholder)
-- Superseded by 20260920000000_gym_regions.sql, which retires these rows and
-- seeds the real gym list grouped by region. Kept so the migration history
-- matches databases that already applied it.
-- Rename/edit these in the SQL editor or add your own rows in the app
-- (Settings → Gyms). Custom one-off names can also be typed per session
-- without creating a gym row.

insert into public.gyms (name, city)
values
  ('Boulder Barn', null),
  ('Vertical Hub', null),
  ('The Crux', null),
  ('Northside Climbing Centre', null),
  ('Summit Loft', null),
  ('Riverside Boulders', null)
on conflict do nothing;
