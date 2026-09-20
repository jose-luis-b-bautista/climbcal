-- climbcal — gyms are curated by admins only
--
-- The gym list is shared reference data: seeded by the migrations and maintained
-- by whoever administers the project (SQL editor / `supabase db push`), which
-- runs as the table owner and is not subject to RLS. Signed-in users may only
-- read it — a one-off gym belongs in the session's free-text `custom_gym_name`.
--
-- This replaces the `gyms_insert_own` / `gyms_update_own` / `gyms_delete_own`
-- policies from 20260919000000_init.sql, which let any signed-in climber add a
-- gym (and edit their own additions). Idempotent: safe to re-run.

drop policy if exists gyms_insert_own on public.gyms;
drop policy if exists gyms_update_own on public.gyms;
drop policy if exists gyms_delete_own on public.gyms;

-- Belt and braces: the GRANTs from init.sql are revoked too, so even a future
-- policy cannot quietly re-open writes by accident.
revoke insert, update, delete on public.gyms from authenticated;

-- Reading stays open to every signed-in climber (RLS `gyms_select_authenticated`
-- plus this grant). New gyms are added by an admin with, e.g.:
--
--   insert into public.gyms (name, city, region)
--   values ('New Gym', 'Quezon City', 'Luzon')
--   on conflict (lower(btrim(name))) do update set region = excluded.region;

grant select on public.gyms to authenticated;
