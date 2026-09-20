-- climbcal — a session can name one gym, two ("either"), or none yet
--
-- Two changes to support the Add-a-session dialog:
--   * `gym_id_2` / `custom_gym_name_2` hold an optional *alternative* gym, shown
--     as "Either X or Y";
--   * a gym is no longer required — "Not sure yet" is a valid answer, so the old
--     `climbs_gym_present` rule goes away.
--
-- Each slot is either a listed gym or a typed name (never both), a typed name is
-- never blank, and the second slot cannot repeat the first. Idempotent.

alter table public.climbs
  add column if not exists gym_id_2 uuid,
  add column if not exists custom_gym_name_2 text;

-- The FK is named explicitly: `climbs` now has two references to `gyms`, and
-- PostgREST needs both names to disambiguate the embedded selects it serves
-- (`gym:gyms!climbs_gym_id_fkey(...)`, `gym_2:gyms!climbs_gym_id_2_fkey(...)`).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'climbs_gym_id_2_fkey') then
    alter table public.climbs
      add constraint climbs_gym_id_2_fkey
      foreign key (gym_id_2) references public.gyms (id) on delete set null;
  end if;
end
$$;

-- "Not sure yet" is allowed now, so the presence rule is dropped.
alter table public.climbs drop constraint if exists climbs_gym_present;

-- One slot = one gym or one typed name, never both.
alter table public.climbs drop constraint if exists climbs_gym_slot_shape;
alter table public.climbs add constraint climbs_gym_slot_shape check (
  not (gym_id is not null and custom_gym_name is not null)
  and not (gym_id_2 is not null and custom_gym_name_2 is not null)
);

-- A typed name is never blank (btrim catches whitespace-only input).
alter table public.climbs drop constraint if exists climbs_custom_gym_not_blank;
alter table public.climbs add constraint climbs_custom_gym_not_blank check (
  (custom_gym_name is null or length(btrim(custom_gym_name)) > 0)
  and (custom_gym_name_2 is null or length(btrim(custom_gym_name_2)) > 0)
);

-- The second gym is an alternative, not a duplicate.
alter table public.climbs drop constraint if exists climbs_gym_alternatives_distinct;
alter table public.climbs add constraint climbs_gym_alternatives_distinct check (
  gym_id is null or gym_id_2 is null or gym_id <> gym_id_2
);
