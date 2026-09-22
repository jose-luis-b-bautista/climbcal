import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '../types'

/** How many public profiles the "Find climbers" list offers at a time. */
export const PUBLIC_CLIMBER_LIMIT = 20

interface UsePublicClimbersResult {
  /** Newest public climbers first, excluding the signed-in user. */
  climbers: Profile[]
  loading: boolean
  error: string | null
}

/**
 * The "people you could add" list for the Friends page: public profiles, most
 * recently joined first, without the signed-in user. Which of them are actually
 * addable is decided by the caller, once the friendship rows are in.
 */
export function usePublicClimbers(enabled = true): UsePublicClimbersResult {
  const { userId } = useAuth()
  const [climbers, setClimbers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !userId) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('visibility', 'public')
        .neq('id', userId)
        // A profile without a username has nothing to show or request.
        .not('username', 'is', null)
        .order('created_at', { ascending: false })
        .limit(PUBLIC_CLIMBER_LIMIT)

      if (!active) return

      if (profilesError) {
        setError(profilesError.message)
        setClimbers([])
      } else {
        setClimbers((data ?? []) as Profile[])
      }
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [enabled, userId])

  return { climbers, loading: enabled ? loading : false, error }
}