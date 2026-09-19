/**
 * Date helpers for the weekly view.
 *
 * Everything is deliberately local-time and string based (`YYYY-MM-DD`) to keep
 * Postgres `date` columns and `input[type=date]` values in agreement without
 * UTC shifting surprises.
 */

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Local-time `YYYY-MM-DD`. */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parse `YYYY-MM-DD` into a local-midnight Date. */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

/** Monday of the week containing `date` (weeks run Mon → Sun). */
export function startOfWeek(date: Date): Date {
  const day = date.getDay() // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day
  const monday = addDays(date, offset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** The seven local dates of the week starting at `weekStart` (a Monday). */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function isSameDate(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function isToday(value: string | Date): boolean {
  return toISODate(typeof value === 'string' ? parseISODate(value) : value) === toISODate(new Date())
}

/** e.g. "Sep 15 – Sep 21, 2026" (collapses the month when possible). */
export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()
  const startLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  })

  if (sameMonth && sameYear) {
    return `${startLabel} – ${endLabel}, ${weekEnd.getFullYear()}`
  }
  return `${startLabel}${sameYear ? '' : `, ${weekStart.getFullYear()}`} – ${endLabel}, ${weekEnd.getFullYear()}`
}

/** e.g. "Wednesday, Sep 17". */
export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

/** e.g. "Sep 17". */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISODate(value) : value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** e.g. "Wed, Sep 17" — used for the feed and day headers. */
export function formatMediumDate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISODate(value) : value
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Postgres returns `HH:MM:SS`; inputs and displays use `HH:MM`. */
export function trimTime(value: string): string {
  return value.slice(0, 5)
}

/** e.g. "18:30 – 21:00". */
export function formatTimeWindow(start: string, end: string): string {
  return `${trimTime(start)} – ${trimTime(end)}`
}

/** Human duration between two `HH:MM[:SS]` values, e.g. "2h 30m". */
export function formatDuration(start: string, end: string): string {
  const [startHours, startMinutes] = trimTime(start).split(':').map(Number)
  const [endHours, endMinutes] = trimTime(end).split(':').map(Number)
  const total = Math.max(0, endHours * 60 + endMinutes - (startHours * 60 + startMinutes))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/** Sort by date then start time, ascending. */
export function compareClimbsByTime(
  a: { climb_date: string; start_time: string },
  b: { climb_date: string; start_time: string },
): number {
  if (a.climb_date !== b.climb_date) return a.climb_date < b.climb_date ? -1 : 1
  return a.start_time < b.start_time ? -1 : 1
}
