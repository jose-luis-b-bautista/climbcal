/**
 * Flexible time-of-day labels that can stand in for an exact clock time at
 * either end of a session window ("Opening", "Before Dinner", …).
 *
 * `minutes` is a canonical position on the day (minutes past midnight) used
 * *only* to order and validate windows — it is never shown to a user, because
 * a label like "Closing" means whatever the gym means by it. The same scale
 * lives in SQL as `public.window_minutes(time, text)` (see
 * `supabase/migrations/20260920000100_session_windows.sql`); `slots.test.ts`
 * reads that file and fails if the two ever drift apart.
 */
export interface TimeSlot {
  label: string
  minutes: number
}

export const TIME_SLOTS = [
  { label: 'Opening', minutes: 6 * 60 },
  { label: 'Before Lunch', minutes: 10 * 60 + 30 },
  { label: 'Around Lunch', minutes: 12 * 60 + 30 },
  { label: 'Early Afternoon', minutes: 14 * 60 + 30 },
  { label: 'Late Afternoon', minutes: 17 * 60 },
  { label: 'Before Dinner', minutes: 18 * 60 + 30 },
  { label: 'After Dinner', minutes: 20 * 60 + 30 },
  { label: 'Closing', minutes: 22 * 60 + 30 },
] as const satisfies readonly TimeSlot[]

/** The eight slot labels, e.g. `'Opening' | 'Before Lunch' | … | 'Closing'`. */
export type TimeSlotLabel = (typeof TIME_SLOTS)[number]['label']

const SLOT_MINUTES = new Map<string, number>(
  TIME_SLOTS.map((slot): [string, number] => [slot.label, slot.minutes]),
)

/** Canonical minutes past midnight for a slot label, or null if it isn't one. */
export function slotMinutes(label: string | null | undefined): number | null {
  if (!label) return null
  return SLOT_MINUTES.get(label.trim()) ?? null
}
