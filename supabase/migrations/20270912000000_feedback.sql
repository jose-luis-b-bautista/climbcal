-- climbcal — feedback table for user-submitted support/feature requests
--
-- Anyone signed in may insert feedback; admins read/delete only.
--
-- Column notes:
--   feedback_type: optional categorization (bug, feature, general, etc.)
--   status: workflow tracking; defaults to 'new'
--   admin_notes: internal-only notes (read/write by admins only)

-- 1. Ensure the feedback_status enum exists FIRST (before the table).
--    Plain `create type` (not dynamic `execute`) so no quote-escaping is needed;
--    matches the pattern in 20260919000000_init.sql.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type public.feedback_status as enum ('new', 'in_progress', 'resolved', 'dismissed');
  end if;
end
$$;

-- 2. Now create the table using the enum.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_type text, -- optional categorization
  message text not null,
  created_at timestamptz not null default now(),
  status public.feedback_status not null default 'new',
  admin_notes text
);

create index if not exists feedback_user_idx on public.feedback (user_id);
create index if not exists feedback_status_idx on public.feedback (status);

-- 3. RLS policies:
--   Insert: any authenticated user may submit feedback.
--   Select: admins may read all feedback.
--   Update: admins may update status and admin_notes.
--   Delete: admins may delete resolved/dismissed feedback.

-- Insert: anyone signed in may submit feedback.
drop policy if exists feedback_insert_authenticated on public.feedback;
create policy feedback_insert_authenticated on public.feedback
  for insert to authenticated
  with check (true);

-- Select: admins only (using the same is_admin function as elsewhere).
drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback
  for select to authenticated
  using (public.is_admin(auth.uid()));

-- Update: admins only, to modify status and admin_notes.
drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Delete: admins only, prefer resolved/dismissed rows.
drop policy if exists feedback_delete_admin on public.feedback;
create policy feedback_delete_admin on public.feedback
  for delete to authenticated
  using (public.is_admin(auth.uid()) and status in ('resolved', 'dismissed'));

-- Grants: authenticated users can insert; admins get select/update/delete.
grant insert on public.feedback to authenticated;
grant select, update, delete on public.feedback to authenticated;