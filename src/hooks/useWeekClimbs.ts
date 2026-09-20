import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compareClimbsByTime } from '../lib/date'
import type { ClimbEntry, ClimbWithGym, Profile } from '../types'

interface UseClimbsArgs {
  /** Inclusive start of the range (`YYYY-MM-DD`). */
  startDate: string
  /** Inclusive end of the range (`YYYY-MM-DD`). */
  endDate: string
  /**
   * Climbers to load. `null` loads every row RLS allows in the range (used by
   * the public feed); an array restricts to those ids (self + friends).
   * An empty array means "nobody", which short-circuits to an empty result.
   */
  participantIds: string[] | null
  enabled?: boolean
}

interface UseClimbsResult {
  entries: ClimbEntry[]
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Loads climbs in a date range together with the profile of each climber, and
 * exposes them sorted by date + start time. RLS decides which rows come back.
 */
export function useClimbs({
  startDate,
  endDate,
  participantIds,
  enabled = true,
}: UseClimbsArgs): UseClimbsResult {
  const [climbs, setClimbs] = useState<ClimbWithGym[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const idsKey = participantIds ? participantIds.slice().sort().join(',') : 'all'

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)
      let query = supabase
        .from('climbs')
        .select(
          '*, gym:gyms!climbs_gym_id_fkey(id, name), gym_2:gyms!climbs_gym_id_2_fkey(id, name)',
        )
        .gte('climb_date', startDate)
        .lte('climb_date', endDate)
        .order('climb_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (participantIds !== null) {
        if (participantIds.length === 0) {
          if (active) {
            setClimbs([])
            setProfiles({})
            setLoading(false)
          }
          return
        }
        query = query.in('user_id', participantIds)
      }

      const { data: climbRows, error: climbsError } = await query
      if (!active) return

      if (climbsError) {
        setError(climbsError.message)
        setClimbs([])
        setProfiles({})
        setLoading(false)
        return
      }

      const rows = (climbRows ?? []) as ClimbWithGym[]
      const userIds = Array.from(new Set(rows.map((row) => row.user_id)))

      let profileMap: Record<string, Profile> = {}
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        if (!active) return

        if (profilesError) {
          setError(profilesError.message)
        } else {
          profileMap = Object.fromEntries((profileRows ?? []).map((row) => [row.id, row]))
        }
      }

      setClimbs(rows)
      setProfiles(profileMap)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
    // idsKey captures the content of participantIds without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, idsKey, enabled, nonce])

  const entries = useMemo<ClimbEntry[]>(() => {
    return climbs
      .slice()
      .sort(compareClimbsByTime)
      .map((climb) => ({
        ...climb,
        climber:
          profiles[climb.user_id] ??
          ({
            id: climb.user_id,
            username: null,
            display_name: null,
            visibility: 'private',
            created_at: climb.created_at,
            updated_at: climb.updated_at,
          } satisfies Profile),
      }))
  }, [climbs, profiles])

  return { entries, loading: enabled ? loading : false, error, reload }
}

/**
 * Convenience wrapper for the home page: climbs for the signed-in user plus
 * their accepted friends, for one week.
 */
export function useWeekClimbs(
  weekStartDate: string,
  weekEndDate: string,
  participantIds: string[] | null,
  enabled = true,
): UseClimbsResult {
  return useClimbs({ startDate: weekStartDate, endDate: weekEndDate, participantIds, enabled })
}

/** Groups entries by `climb_date`, preserving ascending date order. */
export function groupByDate(entries: ClimbEntry[]): Array<{ date: string; entries: ClimbEntry[] }> {
  const groups = new Map<string, ClimbEntry[]>()
  for (const entry of entries) {
    const bucket = groups.get(entry.climb_date)
    if (bucket) bucket.push(entry)
    else groups.set(entry.climb_date, [entry])
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, groupEntries]) => ({
      date,
      entries: groupEntries.slice().sort(compareClimbsByTime),
    }))
}
