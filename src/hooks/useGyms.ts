import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Gym } from '../types'

interface UseGymsResult {
  gyms: Gym[]
  loading: boolean
  error: string | null
  reload: () => void
  /** Adds a user-created gym and returns the inserted row. */
  addGym: (name: string, city?: string | null, region?: string | null) => Promise<Gym>
}

/** Loads the shared gym list (seeded rows plus user-created ones). */
export function useGyms(enabled = true): UseGymsResult {
  const { userId } = useAuth()
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

  const addGym = useCallback(
    async (name: string, city?: string | null, region?: string | null) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Gym name is required.')

      const { data, error: insertError } = await supabase
        .from('gyms')
        .insert({
          name: trimmed,
          city: city?.trim() || null,
          region: region?.trim() || null,
          created_by: userId,
        })
        .select('*')
        .single()

      if (insertError) {
        if (insertError.code === '23505') throw new Error('That gym already exists.')
        throw new Error(insertError.message)
      }

      reload()
      return data as Gym
    },
    [userId, reload],
  )

  return { gyms, loading: enabled ? loading : false, error, reload, addGym }
}
