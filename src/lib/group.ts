/**
 * Grouping helpers for the feed, kept free of React so they can be unit-tested.
 *
 * The feed answers "who is going where", so sessions are grouped by gym rather
 * than only by day: a gym with three climbers reads as one block.
 */
import { compareClimbsByTime } from './date'
import { climbGymNames, gymNameOf } from './format'
import type { ClimbEntry, Profile } from '../types'

export interface GymGroup {
  /** The gym this group is for, or the climb's own label when none was named. */
  gymName: string
  entries: ClimbEntry[]
  /** Distinct climbers heading there — two sessions by one person count once. */
  climberCount: number
}

export interface GroupByGymOptions {
  /**
   * Bucket everything under this one gym. Used when the feed is filtered to a
   * gym, so a session listing two gyms ("Either X or Y") cannot sprout a second
   * group for the gym the reader is not looking at.
   */
  onlyGymName?: string
}

/**
 * Groups sessions by gym:
 * - a session that lists two gyms appears under **both** (that is the point of
 *   the second slot),
 * - a session that named no gym at all falls back to its own label
 *   ("Not sure yet") so nothing silently disappears,
 * - busiest gym first, then alphabetical, for a stable scan order.
 */
export function groupByGym(entries: ClimbEntry[], options: GroupByGymOptions = {}): GymGroup[] {
  const buckets = new Map<string, ClimbEntry[]>()

  for (const entry of entries) {
    const names = climbGymNames(entry)
    const keys = options.onlyGymName
      ? [options.onlyGymName]
      : names.length > 0
        ? names
        : [gymNameOf(entry)]

    for (const key of keys) {
      const bucket = buckets.get(key)
      if (bucket) bucket.push(entry)
      else buckets.set(key, [entry])
    }
  }

  return [...buckets.entries()]
    .map(([gymName, rows]) => ({
      gymName,
      entries: [...rows].sort(compareClimbsByTime),
      climberCount: new Set(rows.map((row) => row.user_id)).size,
    }))
    .sort((a, b) => b.climberCount - a.climberCount || a.gymName.localeCompare(b.gymName))
}

/** Entries keyed by `climb_date` (ascending), with each day sorted by time. */
export function indexByDate(entries: ClimbEntry[]): Map<string, ClimbEntry[]> {
  const byDate = new Map<string, ClimbEntry[]>()

  for (const entry of entries) {
    const bucket = byDate.get(entry.climb_date)
    if (bucket) bucket.push(entry)
    else byDate.set(entry.climb_date, [entry])
  }

  for (const bucket of byDate.values()) bucket.sort(compareClimbsByTime)

  return new Map([...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/** Distinct climbers across `entries`, in order of first appearance. */
export function uniqueClimbers(entries: ClimbEntry[]): Profile[] {
  const seen = new Map<string, Profile>()
  for (const entry of entries) {
    if (!seen.has(entry.user_id)) seen.set(entry.user_id, entry.climber)
  }
  return [...seen.values()]
}
