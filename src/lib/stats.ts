/**
 * Pure helpers for the stats page, kept free of React so they can be unit-tested
 * — the same split `lib/group.ts` uses for the feed.
 *
 * Everything here works off the read-only views in
 * `supabase/migrations/20260923000000_stats_views.sql`: `climber_daily_activity`
 * for the heatmap and `climber_gym_stats` for the breakdown.
 */
import type { ClimberDailyActivityRow, ClimberGymStatsRow } from '../types'
import { addDays, startOfWeek, toISODate } from './date'

/** Heatmap columns: half a year of weeks, ending with the current one. */
export const HEATMAP_WEEKS = 26

/** Sessions in a day → heat level. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

/**
 * The level comes from the session count rather than minutes: a slot-only plan
 * ("Opening" – "Closing") has no real duration, but every row has a count.
 */
export function heatLevel(sessions: number): HeatLevel {
  if (sessions <= 0) return 0
  if (sessions === 1) return 1
  if (sessions === 2) return 2
  if (sessions === 3) return 3
  return 4
}

/**
 * One class per level, darkest-first for an empty day. The four emerald steps are
 * `900 → 600`, which is the one ramp in `index.css` that stays monotone and
 * distinguishable in *both* themes (in the light theme `emerald-400` collapses
 * onto `emerald-600`).
 */
export const HEAT_LEVEL_CLASSES = [
  'bg-zinc-800/70',
  'bg-emerald-900',
  'bg-emerald-800',
  'bg-emerald-700',
  'bg-emerald-600',
] as const

/** A day still to come: a plan, so it reads as an outline rather than a level. */
export const HEAT_PLANNED_CLASS = 'border border-dashed border-sky-900/60 bg-sky-950/40'

export interface HeatmapDay {
  date: string
  sessions: number
  exactMinutes: number
  /** After today — planned rather than climbed. */
  planned: boolean
}

export interface HeatmapWeek {
  /** Monday of the column. */
  weekStart: string
  days: HeatmapDay[]
}

/** Sessions and exact-window minutes per day, keyed by `climb_date`. */
export function activityByDate(
  rows: ClimberDailyActivityRow[],
): Map<string, { sessions: number; exactMinutes: number }> {
  const byDate = new Map<string, { sessions: number; exactMinutes: number }>()

  for (const row of rows) {
    const current = byDate.get(row.climb_date)
    byDate.set(row.climb_date, {
      sessions: (current?.sessions ?? 0) + row.sessions,
      exactMinutes: (current?.exactMinutes ?? 0) + row.exact_minutes,
    })
  }

  return byDate
}

/** Monday of the first heatmap column — also the query's `since` date. */
export function heatmapStartDate(today: Date, weeks = HEATMAP_WEEKS): string {
  return toISODate(addDays(startOfWeek(today), -7 * (weeks - 1)))
}

/**
 * The heatmap grid: `weeks` Monday-first columns ending with the week holding
 * `today`, so the current week is the last column. Days after today keep their
 * own flag instead of pretending to be empty — a climb row is a plan.
 */
export function buildHeatmap(
  today: Date,
  activity: Map<string, { sessions: number; exactMinutes: number }>,
  weeks = HEATMAP_WEEKS,
): HeatmapWeek[] {
  const todayISO = toISODate(today)
  const firstWeekStart = addDays(startOfWeek(today), -7 * (weeks - 1))
  const columns: HeatmapWeek[] = []

  for (let week = 0; week < weeks; week += 1) {
    const weekStart = addDays(firstWeekStart, week * 7)
    const days: HeatmapDay[] = []

    for (let offset = 0; offset < 7; offset += 1) {
      const date = toISODate(addDays(weekStart, offset))
      const found = activity.get(date)
      days.push({
        date,
        sessions: found?.sessions ?? 0,
        exactMinutes: found?.exactMinutes ?? 0,
        planned: date > todayISO,
      })
    }

    columns.push({ weekStart: toISODate(weekStart), days })
  }

  return columns
}

/**
 * Gym breakdown order: most sessions first, then alphabetical for a stable scan,
 * with the unnamed bucket ('Not sure yet') always last — it is not a gym, and it
 * should not push one down the list just because it is large.
 */
export function rankGymStats(rows: ClimberGymStatsRow[]): ClimberGymStatsRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_named_gym !== b.is_named_gym) return a.is_named_gym ? -1 : 1
    if (a.sessions !== b.sessions) return b.sessions - a.sessions
    return a.gym_name.localeCompare(b.gym_name)
  })
}

/** Bar width for a row as a percentage of the busiest bar: clamped to 4–100 %. */
export function gymShare(sessions: number, busiest: number): number {
  if (busiest <= 0 || sessions <= 0) return 0
  return Math.min(100, Math.max(4, Math.round((sessions / busiest) * 100)))
}

/** Sessions across the breakdown, i.e. excluding the unnamed bucket. */
export function namedSessions(rows: ClimberGymStatsRow[]): number {
  return rows.reduce((total, row) => total + (row.is_named_gym ? row.sessions : 0), 0)
}
