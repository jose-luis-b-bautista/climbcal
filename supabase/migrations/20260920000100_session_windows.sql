-- climbcal — flexible session windows
--
-- A session window is either two exact clock times (`start_time` / `end_time`,
-- the original form) or two time-of-day labels (`start_slot` / `end_slot`, e.g.
-- "Opening" … "Closing" — the list mirrors src/lib/slots.ts). Each side picks
-- one of the two forms; the constraints below make any other shape impossible.
--
-- `public.window_minutes` maps both forms onto one canonical scale (minutes past
-- midnight) so ordering is a single rule, mixed windows included. It is never
-- displayed — the app shows the label or the clock time verbatim.
-- Idempotent: safe to re-run.

alter table public.climbs
  add column if not exists start_slot text,
  add column if not exists end_slot text;

alter table public.climbs
  alter column start_time drop not null,
  alter column end_time drop not null;

create or replace function public.window_minutes(t time, slot text)
returns integer
language sql
immutable
as $$
  select case
    when t is not null then extract(hour from t)::int * 60 + extract(minute from t)::int
    else case slot
      when 'Opening' then 360
      when 'Before Lunch' then 630
      when 'Around Lunch' then 750
      when 'Early Afternoon' then 870
      when 'Late Afternoon' then 1020
      when 'Before Dinner' then 1110
      when 'After Dinner' then 1230
      when 'Closing' then 1350
      else null
    end
  end
$$;

-- Exactly one form per side: a clock time xor a slot label.
alter table public.climbs drop constraint if exists climbs_window_shape;
alter table public.climbs add constraint climbs_window_shape check (
  (start_time is not null) <> (start_slot is not null)
  and (end_time is not null) <> (end_slot is not null)
);

-- Only the known labels (window_minutes returns null for anything else).
alter table public.climbs drop constraint if exists climbs_slot_labels;
alter table public.climbs add constraint climbs_slot_labels check (
  (start_slot is null or public.window_minutes(null, start_slot) is not null)
  and (end_slot is null or public.window_minutes(null, end_slot) is not null)
);

-- The end has to come after the start, whichever forms are in play.
alter table public.climbs drop constraint if exists climbs_window_order;
alter table public.climbs add constraint climbs_window_order check (
  public.window_minutes(start_time, start_slot)
    < public.window_minutes(end_time, end_slot)
);

-- Superseded by climbs_window_order above.
alter table public.climbs drop constraint if exists climbs_time_order;

grant execute on function public.window_minutes(time, text) to authenticated;
