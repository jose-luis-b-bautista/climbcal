import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Gym } from '../types'

interface UseGymsResult {
  gyms: Gym[]
  loading: boolean
  error: string | null
  /** Re-reads the list, for callers that write to it (the admin dashboard). */
  reload: () => void
}

/**
 * Loads the shared gym list.
 *
 * Read-only for normal users: gyms are curated reference data (see
 * `supabase/migrations/20260920000200_gyms_admin_only.sql`), and a one-off gym
 * goes in a session's free-text `custom_gym_name` instead of a new row. Only the
 * admin dashboard writes to it, and only for accounts with `is_admin`.
 */
export function useGyms(enabled = true): UseGymsResult {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data, error: gymsError } = await supabase
        .from('gyms')
        .select('*')
        .order('name', { ascending: true })

      if (!active) return

      if (gymsError) {
        setError(gymsError.message)
        setGyms([])
      } else {
        setGyms((data ?? []) as Gym[])
      }
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [enabled, nonce])

  return { gyms, loading: enabled ? loading : false, error, reload }
}
