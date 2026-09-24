/**
 * Hand-written types mirroring the migrations in `supabase/migrations/`
 * (init: schema, seed_gyms + gym_regions: gym list).
 * Keep in sync when the schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Visibility = 'public' | 'private'
export type FriendshipStatus = 'pending' | 'accepted'

export type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  visibility: Visibility
  created_at: string
  updated_at: string
}

export type GymRow = {
  id: string
  name: string
  city: string | null
  /** Island region the gym is grouped under (Luzon / Visayas / Mindanao / …). */
  region: string | null
  created_by: string | null
  created_at: string
}

export type ClimbRow = {
  id: string
  user_id: string
  climb_date: string
  /** Exact clock time, xor `start_slot` / `end_slot` (see lib/slots). */
  start_time: string | null
  end_time: string | null
  /** Flexible time-of-day label, e.g. "Opening" / "Closing". */
  start_slot: string | null
  end_slot: string | null
  /** Gym slot 1: a listed gym or a typed `custom_gym_name`; both may be null. */
  gym_id: string | null
  custom_gym_name: string | null
  /** Optional alternative gym slot 2 — rendered as "Either X or Y". */
  gym_id_2: string | null
  custom_gym_name_2: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

/**
 * Row of the `climb_sessions` view: one climb with its window flattened onto the
 * canonical minutes-past-midnight scale (`public.window_minutes`).
 * `duration_minutes` is notional for a slot-only window — show it only when
 * `is_exact_window` is true.
 */
export type ClimbSessionRow = {
  id: string
  user_id: string
  climb_date: string
  /** Monday of the week containing `climb_date` (matches `lib/date.startOfWeek`). */
  week_start: string
  /** 1 = Monday … 7 = Sunday (`isodow`) — the `DAY_NAMES_SHORT` order. */
  iso_dow: number
  start_time: string | null
  end_time: string | null
  start_slot: string | null
  end_slot: string | null
  start_minutes: number
  end_minutes: number
  duration_minutes: number
  /** Both ends are clock times, so `duration_minutes` is a real reading. */
  is_exact_window: boolean
  has_note: boolean
  created_at: string
  updated_at: string
}

/**
 * Row of the `climb_gyms` view: one climb per *named* gym. A session listing two
 * gyms has two rows ("Either X or Y"); a session that named no gym keeps a single
 * synthetic `gym_name = 'Not sure yet'` row with `is_named_gym = false`.
 */
export type ClimbGymRow = {
  climb_id: string
  user_id: string
  climb_date: string
  /** 1 = the primary slot, 2 = the optional "either" slot. */
  slot: number
  gym_id: string | null
  /** Linked gym name, else the typed one-off name. Never blank. */
  gym_name: string
  /** From `gyms.region`; null for typed names. `'Other'` is applied by the rollups. */
  region: string | null
  is_named_gym: boolean
}

/** Row of the `climber_daily_activity` view: heatmap data, one row per day. */
export type ClimberDailyActivityRow = {
  user_id: string
  climb_date: string
  week_start: string
  iso_dow: number
  /** Sessions planned that day (two sessions in one day count twice). */
  sessions: number
  exact_sessions: number
  duration_minutes: number
  /** Minutes from exact clock windows only. */
  exact_minutes: number
  notes: number
}

/** Row of the `climber_totals` view: the headline card numbers. */
export type ClimberTotalsRow = {
  user_id: string
  sessions: number
  /** Sessions on or before today. */
  sessions_past: number
  /** Sessions after today — a climb row is a plan, so this is normal. */
  sessions_upcoming: number
  active_days: number
  active_weeks: number
  active_months: number
  first_session: string | null
  last_session: string | null
  /** Minutes from exact clock windows only, past sessions only. */
  exact_minutes: number
  /** Mean exact-window minutes per past session, rounded. */
  avg_exact_minutes: number | null
  /** Exact-window minutes still to come (planned sessions). */
  exact_minutes_upcoming: number
  sessions_with_note: number
  /** Distinct named gyms — the 'Not sure yet' bucket is excluded. */
  gyms_visited: number
  regions_visited: number
}

/** Row of the `climber_gym_stats` view: the "where I climb" breakdown. */
export type ClimberGymStatsRow = {
  user_id: string
  gym_name: string
  /** `gyms.region`, with untagged gyms (and typed names) folded into `'Other'`. */
  region: string
  /** False on the 'Not sure yet' bucket — filter it out for a gyms-only chart. */
  is_named_gym: boolean
  sessions: number
  days: number
  first_visit: string
  last_visit: string
  duration_minutes: number
  exact_minutes: number
}

/**
 * One session on a shared (`/u/<username>`) profile.
 *
 * The gyms arrive pre-resolved as names — the public payload never exposes
 * `gym_id`s — and there is deliberately **no note**: the share link shows time
 * and place only (see `20260924000000_public_profile_share.sql`).
 */
export type SharedProfileSession = {
  id: string
  climb_date: string
  start_time: string | null
  end_time: string | null
  start_slot: string | null
  end_slot: string | null
  /** A listed gym name, else the free-text name on the session. Null when unnamed. */
  gym_name: string | null
  /** The optional "either" gym, same rules as `gym_name`. */
  gym_name_2: string | null
}

/**
 * Payload of the `shared_profile` RPC: the public face of one climber's week.
 * Only ever produced for `visibility = 'public'` profiles, so `profile` needs no
 * extra narrowing.
 */
export type SharedProfilePayload = {
  profile: ProfileRow
  /** Monday of the week the sessions belong to (`YYYY-MM-DD`). */
  week_start: string
  sessions: SharedProfileSession[]
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          visibility?: Visibility
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          visibility?: Visibility
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      gyms: {
        Row: GymRow
        Insert: {
          id?: string
          name: string
          city?: string | null
          region?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string | null
          region?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gyms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      climbs: {
        Row: ClimbRow
        Insert: {
          id?: string
          user_id: string
          climb_date: string
          start_time?: string | null
          end_time?: string | null
          start_slot?: string | null
          end_slot?: string | null
          gym_id?: string | null
          custom_gym_name?: string | null
          gym_id_2?: string | null
          custom_gym_name_2?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          climb_date?: string
          start_time?: string | null
          end_time?: string | null
          start_slot?: string | null
          end_slot?: string | null
          gym_id?: string | null
          custom_gym_name?: string | null
          gym_id_2?: string | null
          custom_gym_name_2?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'climbs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'climbs_gym_id_fkey'
            columns: ['gym_id']
            isOneToOne: false
            referencedRelation: 'gyms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'climbs_gym_id_2_fkey'
            columns: ['gym_id_2']
            isOneToOne: false
            referencedRelation: 'gyms'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: FriendshipRow
        Insert: {
          id?: string
          requester_id: string
          addressee_id: string
          status?: FriendshipStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          addressee_id?: string
          status?: FriendshipStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendships_addressee_id_fkey'
            columns: ['addressee_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      /** One row per climb, window normalised (see `ClimbSessionRow`). */
      climb_sessions: {
        Row: ClimbSessionRow
        Relationships: []
      }
      /** One row per climb per named gym (see `ClimbGymRow`). */
      climb_gyms: {
        Row: ClimbGymRow
        Relationships: []
      }
      /** Heatmap grain: one row per climber per day. */
      climber_daily_activity: {
        Row: ClimberDailyActivityRow
        Relationships: []
      }
      /** Headline card numbers per climber. */
      climber_totals: {
        Row: ClimberTotalsRow
        Relationships: []
      }
      /** "Where I climb" per climber per gym. */
      climber_gym_stats: {
        Row: ClimberGymStatsRow
        Relationships: []
      }
    }
    Functions: {
      are_friends: {
        Args: { a: string; b: string }
        Returns: boolean
      }
      profile_is_public: {
        Args: { target: string }
        Returns: boolean
      }
      /**
       * Public snapshot for a `/u/<username>` share link. `null` when the
       * username is unknown *or* the profile is private.
       */
      shared_profile: {
        Args: { p_username: string; p_week_start?: string | null }
        Returns: SharedProfilePayload | null
      }
    }
    Enums: {
      visibility: Visibility
      friendship_status: FriendshipStatus
    }
    CompositeTypes: Record<string, never>
  }
}

export type Profile = ProfileRow
export type Gym = GymRow
export type Climb = ClimbRow
export type Friendship = FriendshipRow

/**
 * A climb row with its gym embedded, plus the optional "either" gym:
 * `select('*, gym:gyms!climbs_gym_id_fkey(id, name), gym_2:gyms!climbs_gym_id_2_fkey(id, name)')`.
 * Both embeds name their FK because `climbs` now references `gyms` twice.
 */
export type ClimbWithGym = Climb & {
  gym: Pick<Gym, 'id' | 'name'> | null
  gym_2: Pick<Gym, 'id' | 'name'> | null
}

/** A climb joined with the profile of the climber, ready for rendering. */
export type ClimbEntry = ClimbWithGym & {
  climber: Profile
}
