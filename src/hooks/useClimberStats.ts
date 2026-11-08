import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DayGymRow } from '../lib/stats'
import type {
  ClimberDailyActivityRow,
  ClimberGymStatsRow,
  ClimberTotalsRow,
} from '../types'

interface UseClimberStatsArgs {
  /** Whose stats to read - RLS decides whose climbs actually come back. */
  userId: string | null
  /** Earliest `climb_date` for the activity rows (the heatmap window). */
  sinceDate: string
  enabled?: boolean
}

interface UseClimberStatsResult {
  totals: ClimberTotalsRow | null
  activity: ClimberDailyActivityRow[]
  /**
   * Gym names behind the activity window, one row per climb per named gym - the
   * heatmap's hover label ("Sep 16: 2 sessions · BHive").
   */
  climbGyms: DayGymRow[]
  gymStats: ClimberGymStatsRow[]
  loading: boolean
  error: string | null
  /** The stats views are absent, i.e. the migration has not been applied yet. */
  missingViews: boolean
  reload: () => void
}

/** PostgREST's "relation does not exist" - the views are not deployed. */
function isMissingView(error: { code?: string; message: string }): boolean {
  return error.code === '42P01' || /does not exist/i.test(error.message)
}

/**
 * Loads the stats views for one climber
 * (`supabase/migrations/20260923000000_stats_views.sql`): headline totals, the
 * daily activity behind the heatmap, the gym names behind those same days (so a
 * cell can say *where* you climbed), and the per-gym breakdown.
 *
 * Read-only: the views are `security_invoker`, so a friend's rows come back only
 * while the friendship is accepted.
 */
export function useClimberStats({
  userId,
  sinceDate,
  enabled = true,
}: UseClimberStatsArgs): UseClimberStatsResult {
  const [totals, setTotals] = useState<ClimberTotalsRow | null>(null)
  const [activity, setActivity] = useState<ClimberDailyActivityRow[]>([])
  const [climbGyms, setClimbGyms] = useState<DayGymRow[]>([])
  const [gymStats, setGymStats] = useState<ClimberGymStatsRow[]>([])
  const [loading, setLoading] = useState(enabled && Boolean(userId))
  const [error, setError] = useState<string | null>(null)
  const [missingViews, setMissingViews] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!enabled || !userId) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)

      const [totalsResult, activityResult, climbGymsResult, gymResult] = await Promise.all([
        supabase.from('climber_totals').select('*').eq('user_id', userId).maybeSingle(),
        supabase
          .from('climber_daily_activity')
          .select('*')
          .eq('user_id', userId)
          .gte('climb_date', sinceDate)
          .order('climb_date', { ascending: true }),
        // The same window as the activity rows: `climb_gyms` is one row per climb
        // per named gym, which is exactly what a day's hover label lists. Narrow
        // columns keep the 13-week payload small - this is the widest query here.
        // `user_id` rides along so the page can discard a previous climber's rows
        // while a switch is in flight, like it does for the activity rows.
        supabase
          .from('climb_gyms')
          .select('user_id, climb_date, gym_name')
          .eq('user_id', userId)
          .gte('climb_date', sinceDate)
          .order('climb_date', { ascending: true }),
        supabase
          .from('climber_gym_stats')
          .select('*')
          .eq('user_id', userId)
          .order('sessions', { ascending: false }),
      ])

      if (!active) return

      const failure = [totalsResult, activityResult, climbGymsResult, gymResult].find(
        (result) => result.error,
      )
      if (failure?.error) {
        setError(failure.error.message)
        setMissingViews(isMissingView(failure.error))
      } else {
        setMissingViews(false)
      }

      // Keep whatever did load: a missing view should still show the rest.
      setTotals((totalsResult.data as ClimberTotalsRow | null) ?? null)
      setActivity((activityResult.data ?? []) as ClimberDailyActivityRow[])
      // The select is narrow on purpose, so a row is only the two columns used.
      setClimbGyms((climbGymsResult.data ?? []) as DayGymRow[])
      setGymStats((gymResult.data ?? []) as ClimberGymStatsRow[])
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [userId, sinceDate, enabled, nonce])

  return {
    totals,
    activity,
    climbGyms,
    gymStats,
    loading: enabled && userId ? loading : false,
    error,
    missingViews,
    reload,
  }
}
