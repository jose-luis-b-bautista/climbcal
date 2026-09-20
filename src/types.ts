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
  start_time: string
  end_time: string
  gym_id: string | null
  custom_gym_name: string | null
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
          start_time: string
          end_time: string
          gym_id?: string | null
          custom_gym_name?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          climb_date?: string
          start_time?: string
          end_time?: string
          gym_id?: string | null
          custom_gym_name?: string | null
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
    Views: Record<string, never>
    Functions: {
      are_friends: {
        Args: { a: string; b: string }
        Returns: boolean
      }
      profile_is_public: {
        Args: { target: string }
        Returns: boolean
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

/** A climb row with its gym embedded (see `select('*, gym:gyms(...)')`). */
export type ClimbWithGym = Climb & {
  gym: Pick<Gym, 'id' | 'name'> | null
}

/** A climb joined with the profile of the climber, ready for rendering. */
export type ClimbEntry = ClimbWithGym & {
  climber: Profile
}
