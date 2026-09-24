import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ClimbEntry, ClimbWithGym, Profile } from '../types'

interface UseSharedProfileResult {
  /** The public profile, or null while loading / when nothing is shared. */
  profile: Profile | null
  /** The week's sessions, already shaped for `SessionCard`. */
  entries: ClimbEntry[]
  loading: boolean
  /** No *public* profile has that username (or the row does not exist). */
  notFound: boolean
  error: string | null
}

/**
 * Loads one climber's public "share link" snapshot for `/u/<username>`.
 *
 * The read goes through `public.shared_profile` rather than the tables (see
 * `supabase/migrations/20260924000000_public_profile_share.sql`): anonymous
 * visitors have no grants at all, and the function answers only for a public
 * profile with session notes stripped. `notFound` therefore covers both "no such
 * username" and "that profile is private" — the same answer on purpose, so a
 * share link cannot be used to probe for accounts.
 */
export function useSharedProfile(
  username: string | undefined,
  weekStart: string,
): UseSharedProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<ClimbWithGym[]>([])
  const [loading, setLoading] = useState(Boolean(username))
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)

      const { data, error: rpcError } = await supabase.rpc('shared_profile', {
        p_username: username,
        // The client's local Monday, so the header and the server agree.
        p_week_start: weekStart,
      })

      if (!active) return

      if (rpcError) {
        setError(rpcError.message)
        setProfile(null)
        setSessions([])
      } else if (!data) {
        setProfile(null)
        setSessions([])
        setNotFound(true)
      } else {
        setProfile(data.profile)
        setSessions(
          data.sessions.map((session) => ({
            id: session.id,
            user_id: data.profile.id,
            climb_date: session.climb_date,
            start_time: session.start_time,
            end_time: session.end_time,
            start_slot: session.start_slot,
            end_slot: session.end_slot,
            gym_id: null,
            custom_gym_name: null,
            gym_id_2: null,
            custom_gym_name_2: null,
            // The public payload carries no note — keep it empty rather than
            // letting a stale value leak through.
            note: null,
            created_at: data.profile.created_at,
            updated_at: data.profile.updated_at,
            // Names only: a shared payload never exposes gym ids.
            gym: session.gym_name ? { id: '', name: session.gym_name } : null,
            gym_2: session.gym_name_2 ? { id: '', name: session.gym_name_2 } : null,
          })),
        )
      }
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [username, weekStart])

  const entries = useMemo<ClimbEntry[]>(
    () => (profile ? sessions.map((climb) => ({ ...climb, climber: profile })) : []),
    [profile, sessions],
  )

  return { profile, entries, loading: username ? loading : false, notFound, error }
}
