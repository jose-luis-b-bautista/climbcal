/**
 * Date helpers for the weekly view.
 *
 * Everything is deliberately local-time and string based (`YYYY-MM-DD`) to keep
 * Postgres `date` columns and `input[type=date]` values in agreement without
 * UTC shifting surprises.
 */
import { slotMinutes } from './slots'

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

/** e.g. "18:30 – 21:00", "Opening – Before Lunch" or "Opening – 21:00". */
export function formatTimeWindow(
  start: string | null,
  end: string | null,
  startSlot?: string | null,
  endSlot?: string | null,
): string {
  return `${windowEndLabel(start, startSlot)} – ${windowEndLabel(end, endSlot)}`
}

function windowEndLabel(time: string | null, slot?: string | null): string {
  if (time) return trimTime(time)
  return slot?.trim() || 'Time not set'
}

/** Minutes past midnight for an `HH:MM[:SS]` clock time, or null. */
export function clockMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [hours, minutes] = trimTime(time).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

/**
 * Canonical minutes past midnight for one end of a window: the clock time when
 * there is one, else the slot label's position (see `lib/slots`). Used for
 * ordering and validation only — never for display.
 */
export function windowMinutes(
  time: string | null | undefined,
  slot: string | null | undefined,
): number | null {
  return clockMinutes(time) ?? slotMinutes(slot)
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

/**
 * Sort by date, then by the start of the window on the canonical clock, so
 * slot-based sessions ("Opening") interleave with exact-time ones.
 */
export function compareClimbsByTime(
  a: { climb_date: string; start_time?: string | null; start_slot?: string | null },
  b: { climb_date: string; start_time?: string | null; start_slot?: string | null },
): number {
  if (a.climb_date !== b.climb_date) return a.climb_date < b.climb_date ? -1 : 1
  const aStart = windowMinutes(a.start_time, a.start_slot) ?? Number.MAX_SAFE_INTEGER
  const bStart = windowMinutes(b.start_time, b.start_slot) ?? Number.MAX_SAFE_INTEGER
  return aStart - bStart
}

/** Minutes since midnight for an `HH:MM[:SS]` value (non-null form of `clockMinutes`). */
export function minutesOfDay(value: string): number {
  return clockMinutes(value) ?? 0
}

/** Compact minutes span, e.g. "45m", "2h", "2h 15m". */
export function formatMinutesSpan(totalMinutes: number): string {
  const clamped = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export interface SessionTiming {
  state: 'live' | 'soon' | 'done'
  label: string
}

/**
 * Where a session sits relative to now, for the day views: "On now",
 * "Starts in 45m" or "Finished". Only meaningful for the current day, so any
 * other date returns null and the card shows no badge.
 *
 * A flexible window ("Opening", "After Dinner") is placed on the same scale as
 * a clock time via `windowMinutes`; an end that maps to neither gets no badge.
 */
export function sessionTiming(
  date: string,
  start: string | null,
  end: string | null,
  now: Date = new Date(),
  startSlot?: string | null,
  endSlot?: string | null,
): SessionTiming | null {
  if (date !== toISODate(now)) return null

  const startMinutes = windowMinutes(start, startSlot)
  const endMinutes = windowMinutes(end, endSlot)
  if (startMinutes === null || endMinutes === null) return null

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return { state: 'live', label: 'On now' }
  }
  if (nowMinutes < startMinutes) {
    return { state: 'soon', label: `Starts in ${formatMinutesSpan(startMinutes - nowMinutes)}` }
  }
  return { state: 'done', label: 'Finished' }
}

/* ------------------------------------------------------------------ months --
   The feed's calendar view needs month-sized ranges and a Mon-first grid; the
   week helpers above are deliberately unaware of months.
--------------------------------------------------------------------------- */

/** `YYYY-MM` key for the month containing `date`, e.g. "2026-09". */
export function toISOMonth(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

/** Parse `YYYY-MM` into local midnight on the 1st, or null when unparseable. */
export function parseISOMonth(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null

  return new Date(year, month - 1, 1)
}

/** First day of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Last day of the month containing `date`, at local midnight. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/** Shifts by whole months, clamping the day (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = endOfMonth(target).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay))
}

/** True when both dates fall in the same calendar month. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * The calendar grid for the month containing `date`: complete Mon–Sun weeks from
 * the Monday on/before the 1st to the Sunday on/after the last day (28–42 days),
 * so the grid never has ragged edges.
 */
export function monthDays(date: Date): Date[] {
  const first = startOfWeek(startOfMonth(date))
  const last = addDays(startOfWeek(endOfMonth(date)), 6)

  const days: Date[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

/** e.g. "September 2026". */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
