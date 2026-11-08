/**
 * Pure helpers for the stats page, kept free of React so they can be unit-tested
 * - the same split `lib/group.ts` uses for the feed.
 *
 * Everything here works off the read-only views in
 * `supabase/migrations/20260923000000_stats_views.sql`: `climber_daily_activity`
 * for the heatmap, `climb_gyms` for the gym each heatmap day was spent at, and
 * `climber_gym_stats` for the breakdown.
 */
import type { ClimbGymRow, ClimberDailyActivityRow, ClimberGymStatsRow } from '../types'
import { addDays, parseISOMonth, startOfWeek, toISODate } from './date'
import { OTHER_REGION_LABEL } from './format'

/** Heatmap columns: 13 weeks - a quarter of a year - ending with the current one. */
export const HEATMAP_WEEKS = 13

/**
 * Binary, on purpose: two sessions in one day are rare here, so a graduated scale
 * would collapse into a single shade in practice while making the legend harder to
 * read than the data deserves. The grid answers "did I climb that day?"; the exact
 * count stays in the cell's label.
 */
export type HeatLevel = 0 | 1

/** Any session at all → the one shaded state. */
export function heatLevel(sessions: number): HeatLevel {
  return sessions > 0 ? 1 : 0
}

/**
 * Empty, then climbed. `emerald-700` stays clearly distinct from the empty cell in
 * both themes (the light theme redefines that shade to a mint).
 */
export const HEAT_LEVEL_CLASSES = ['bg-zinc-800/70', 'bg-emerald-700'] as const

/** A day still to come: a plan, so it reads as an outline rather than a level. */
export const HEAT_PLANNED_CLASS = 'border border-dashed border-sky-900/60 bg-sky-950/40'

export interface HeatmapDay {
  date: string
  sessions: number
  exactMinutes: number
  /**
   * Where that day's sessions are: gym names from `climb_gyms`, deduped and
   * sorted so the tooltip does not shuffle between loads. `'Not sure yet'` is the
   * unnamed bucket, and an empty list means no gym was recorded at all (the day
   * has no session, or one whose row is not visible).
   */
  gyms: string[]
  /** After today - planned rather than climbed. */
  planned: boolean
}

export interface HeatmapWeek {
  /** Monday of the column. */
  weekStart: string
  days: HeatmapDay[]
}

/**
 * Consecutive week columns that start in the same calendar month. The heatmap is
 * read month by month ("did I climb this month?"), and a plain 13-column run
 * gives no anchor for that; the label also makes the window's edges legible.
 */
export interface HeatmapMonth {
  /** `YYYY-MM` key of the group. */
  month: string
  /** Short month name for the column header, e.g. "Jun". */
  label: string
  /**
   * That month's columns in order. A week belongs to the month its Monday falls
   * in, so a column straddling a month boundary stays whole - splitting days
   * out of a column would break the Mon–Sun rows.
   */
  weeks: HeatmapWeek[]
}

/**
 * The two `climb_gyms` columns the heatmap's hover needs. The hook selects only
 * these, so a full `ClimbGymRow` would be a lie about what is in memory.
 */
export type DayGymRow = Pick<ClimbGymRow, 'user_id' | 'climb_date' | 'gym_name'>

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

/** Monday of the first heatmap column - also the query's `since` date. */
export function heatmapStartDate(today: Date, weeks = HEATMAP_WEEKS): string {
  return toISODate(addDays(startOfWeek(today), -7 * (weeks - 1)))
}

/**
 * Gym names per day, keyed by `climb_date`, from the `climb_gyms` rows behind the
 * same window as the heatmap - that is what the hover label names.
 *
 * A day can repeat a gym (two sessions there) and a session listing two gyms
 * ("Either X or Y") contributes both, so names are deduped. They are also sorted,
 * because the rows arrive in no guaranteed order within a date and a tooltip that
 * reorders on every load looks like a bug.
 */
export function gymsByDate(rows: DayGymRow[]): Map<string, string[]> {
  const byDate = new Map<string, string[]>()

  for (const row of rows) {
    const names = byDate.get(row.climb_date) ?? []
    if (!names.includes(row.gym_name)) names.push(row.gym_name)
    byDate.set(row.climb_date, names)
  }

  for (const names of byDate.values()) names.sort((a, b) => a.localeCompare(b))

  return byDate
}

/** "Jun" for "2026-06", falling back to the key when it does not parse. */
function shortMonthLabel(isoMonth: string): string {
  const parsed = parseISOMonth(isoMonth)
  return parsed ? parsed.toLocaleDateString(undefined, { month: 'short' }) : isoMonth
}

/**
 * The heatmap grid: `weeks` Monday-first columns ending with the week holding
 * `today`, so the current week is the last column. Days after today keep their
 * own flag instead of pretending to be empty - a climb row is a plan.
 *
 * `gyms` is the same window's {@link gymsByDate} map; it only decorates the
 * cells' labels, so it defaults to empty and a caller without it still gets a
 * complete grid.
 */
export function buildHeatmap(
  today: Date,
  activity: Map<string, { sessions: number; exactMinutes: number }>,
  weeks = HEATMAP_WEEKS,
  gyms: Map<string, string[]> = new Map(),
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
        gyms: gyms.get(date) ?? [],
        planned: date > todayISO,
      })
    }

    columns.push({ weekStart: toISODate(weekStart), days })
  }

  return columns
}

/**
 * Splits the columns into month groups, in order: consecutive weeks whose Monday
 * falls in the same month share one group and therefore one header.
 *
 * Grouping by the week's Monday (rather than by days) keeps every column whole,
 * so the seven weekday rows stay aligned across a month boundary.
 */
export function groupHeatmapByMonth(weeks: HeatmapWeek[]): HeatmapMonth[] {
  const months: HeatmapMonth[] = []

  for (const week of weeks) {
    const month = week.weekStart.slice(0, 7)
    const current = months[months.length - 1]

    if (current?.month === month) current.weeks.push(week)
    else months.push({ month, label: shortMonthLabel(month), weeks: [week] })
  }

  return months
}

/**
 * Weeks in a row with at least one climb.
 *
 * Weeks, not days: a climb row is a plan for a day, and somebody who climbs twice
 * a week would see a day streak reset every other day - a number that says
 * nothing about consistency. Only days that have happened count, because a posted
 * plan is not a climb yet.
 */
export interface WeekStreak {
  /**
   * Weeks in a row ending with the current week, or with the week before it: a
   * week is not over until Sunday, so a quiet Monday–Wednesday does not break a
   * streak - it just has not extended it yet.
   */
  current: number
  /** Longest run anywhere in the grid, i.e. within the heatmap window. */
  best: number
}

export function weekStreak(weeks: HeatmapWeek[]): WeekStreak {
  const climbed = weeks.map((week) =>
    week.days.some((day) => day.sessions > 0 && !day.planned),
  )

  let best = 0
  let run = 0
  for (const active of climbed) {
    run = active ? run + 1 : 0
    best = Math.max(best, run)
  }

  let index = climbed.length - 1
  if (index >= 0 && !climbed[index]) index -= 1

  let current = 0
  while (index >= 0 && climbed[index]) {
    current += 1
    index -= 1
  }

  return { current, best }
}

/**
 * Which weekday the sessions land on - the grid already shows it, this puts it in
 * words. Two sessions on one Wednesday count twice: the question is "when do I
 * climb", not "how many distinct days exist". Days after today are excluded,
 * since those are plans.
 */
export interface WeekdayTally {
  /** 1 = Monday … 7 = Sunday (`DAY_NAMES` order), or null with nothing to count. */
  isoDow: number | null
  /** Sessions on that weekday. */
  sessions: number
  /** Sessions counted in total, so a share can be shown without lying. */
  total: number
}

export function favouriteWeekday(weeks: HeatmapWeek[]): WeekdayTally {
  const byWeekday = new Map<number, number>()
  let total = 0

  for (const week of weeks) {
    week.days.forEach((day, index) => {
      if (day.planned || day.sessions === 0) return
      const isoDow = index + 1
      byWeekday.set(isoDow, (byWeekday.get(isoDow) ?? 0) + day.sessions)
      total += day.sessions
    })
  }

  // Ascending weekday, so a tie goes to the earlier day of the week rather than
  // to whichever Map entry the runtime happens to visit first.
  let isoDow: number | null = null
  let sessions = 0
  for (let day = 1; day <= 7; day += 1) {
    const count = byWeekday.get(day) ?? 0
    if (count > sessions) {
      isoDow = day
      sessions = count
    }
  }

  return { isoDow, sessions, total }
}

/**
 * Sessions per region from the "where I climb" rows, biggest first.
 *
 * `'Other'` (gyms with no region) sorts last, the same way the unnamed gym does in
 * the breakdown: it is a bucket, not a place. Sessions that offered two gyms count
 * under both, exactly as the bars do.
 */
export function sessionsByRegion(
  rows: ClimberGymStatsRow[],
): { region: string; sessions: number }[] {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.region, (totals.get(row.region) ?? 0) + row.sessions)

  return [...totals.entries()]
    .map(([region, sessions]) => ({ region, sessions }))
    .sort((a, b) => {
      const aOther = a.region === OTHER_REGION_LABEL
      const bOther = b.region === OTHER_REGION_LABEL
      if (aOther !== bOther) return aOther ? 1 : -1
      if (a.sessions !== b.sessions) return b.sessions - a.sessions
      return a.region.localeCompare(b.region)
    })
}

/**
 * The next day on the calendar with a session - what this app is actually for.
 * Columns run oldest to newest and days inside a column are ascending, so the
 * first planned day found is the soonest.
 */
export function nextPlannedDay(weeks: HeatmapWeek[]): HeatmapDay | null {
  for (const week of weeks) {
    for (const day of week.days) {
      if (day.planned && day.sessions > 0) return day
    }
  }

  return null
}

/**
 * Gym breakdown order: most sessions first, then alphabetical for a stable scan,
 * with the unnamed bucket ('Not sure yet') always last - it is not a gym, and it
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
