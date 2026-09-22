-- climbcal — admin flag, and admins as the only writers of the gym list
--
-- The /admin route is hidden from the nav and password-gated in the UI, but a
-- password shipped in the bundle is readable by anyone — it is not a security
-- boundary. This is: `profiles.is_admin` plus the policies below. Signing in with
-- the UI password as a non-admin gets a dashboard whose every write the database
-- refuses.
--
-- Promote yourself once, in the SQL editor:
--   update public.profiles set is_admin = true where username = '<you>';
--
-- Idempotent: safe to re-run.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- `security definer` + a pinned search_path is the usual shape for a policy
-- helper: it reads `profiles` as the owner, so it cannot recurse into policies.
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = user_id), false)
$$;

-- Gyms: admins get back the write access 20260920000200 took away from everyone.
drop policy if exists gyms_insert_admin on public.gyms;
create policy gyms_insert_admin on public.gyms
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists gyms_update_admin on public.gyms;
create policy gyms_update_admin on public.gyms
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists gyms_delete_admin on public.gyms;
create policy gyms_delete_admin on public.gyms
  for delete to authenticated
  using (public.is_admin(auth.uid()));

-- Admins read every session too, so the dashboard's numbers are the real ones
-- rather than "whatever this account happens to be allowed to see".
drop policy if exists climbs_select_admin on public.climbs;
create policy climbs_select_admin on public.climbs
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- Grants let the attempt reach the policies above; the policies decide who wins.
grant insert, update, delete on public.gyms to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
