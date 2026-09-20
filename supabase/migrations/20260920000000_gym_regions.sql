-- climbcal — real gym list, grouped by island region
-- Supersedes the placeholder starters from 20260919000100_seed_gyms.sql: those
-- rows are retired and replaced with the actual gyms, each tagged with the
-- region the app groups them by (Luzon / Visayas / Mindanao).
--
-- `region` is deliberately free text rather than an enum: user-created gyms can
-- use any label, and the UI falls back to an "Other" bucket for untagged rows.

alter table public.gyms add column if not exists region text;

-- Sessions that pointed at a retired placeholder keep the label as free text:
-- deleting a gym sets climbs.gym_id to null, which would violate the
-- climbs_gym_present check constraint.
update public.climbs c
set custom_gym_name = g.name
from public.gyms g
where c.gym_id = g.id
  and c.custom_gym_name is null
  and g.created_by is null
  and g.name in (
    'Boulder Barn',
    'Vertical Hub',
    'The Crux',
    'Northside Climbing Centre',
    'Summit Loft',
    'Riverside Boulders'
  );

delete from public.gyms
where created_by is null
  and name in (
    'Boulder Barn',
    'Vertical Hub',
    'The Crux',
    'Northside Climbing Centre',
    'Summit Loft',
    'Riverside Boulders'
  );

insert into public.gyms (name, region)
values
  -- Luzon
  ('Boulder Space', 'Luzon'),
  ('Climb Central Manila', 'Luzon'),
  ('BHive', 'Luzon'),
  ('GHive', 'Luzon'),
  ('Edge Climb', 'Luzon'),
  ('Boulder World', 'Luzon'),
  ('Good Climbs PH', 'Luzon'),
  ('Power Up TS', 'Luzon'),
  ('Power Up Centro', 'Luzon'),
  ('Power Up Alabang', 'Luzon'),
  ('Flow State Bouldering', 'Luzon'),
  ('Urban Peak Wall Climbing', 'Luzon'),
  -- Visayas
  ('Rock On Boulder', 'Visayas'),
  ('Vertex Bouldering', 'Visayas'),
  ('Iloilo Adventure Central', 'Visayas'),
  ('The Pump Factory', 'Visayas'),
  ('Puroc Climbing', 'Visayas'),
  ('Greyhound Climbing', 'Visayas'),
  -- Mindanao
  ('Boulder24', 'Mindanao'),
  ('Guru Rock Climbing', 'Mindanao'),
  ('Climb Anytime', 'Mindanao')
-- Idempotent: re-running refreshes the region instead of duplicating rows.
on conflict ((lower(btrim(name)))) do update
  set region = excluded.region;