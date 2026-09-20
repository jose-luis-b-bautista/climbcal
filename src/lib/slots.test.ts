/**
 * The eight time-of-day slots exist twice: here for the app, and in SQL for the
 * check constraint that guards the same rule on `climbs`. This test reads the
 * migration and fails if the two ever drift apart — the same trick
 * `theme.test.ts` uses on `index.css`.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TIME_SLOTS, slotMinutes } from './slots'

// Paths are relative to the project root, the working directory for `npm test`.
const migration = readFileSync(
  resolvePath(process.cwd(), 'supabase/migrations/20260920000100_session_windows.sql'),
  'utf8',
)

describe('TIME_SLOTS', () => {
  it('is the eight labels in day order', () => {
    expect(TIME_SLOTS.map((slot) => slot.label)).toEqual([
      'Opening',
      'Before Lunch',
      'Around Lunch',
      'Early Afternoon',
      'Late Afternoon',
      'Before Dinner',
      'After Dinner',
      'Closing',
    ])

    const minutes = TIME_SLOTS.map((slot) => slot.minutes)
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b))
  })
})

describe('slotMinutes', () => {
  it('maps a label to its canonical position, trimming whitespace', () => {
    expect(slotMinutes('Opening')).toBe(6 * 60)
    expect(slotMinutes('  Closing ')).toBe(22 * 60 + 30)
  })

  it('returns null for a missing or unknown label', () => {
    expect(slotMinutes(null)).toBeNull()
    expect(slotMinutes('Brunch')).toBeNull()
  })
})

describe('session_windows migration', () => {
  it('knows every slot label with the same canonical minutes', () => {
    const pairs = new Map<string, number>()
    for (const match of migration.matchAll(/when '([^']+)' then (\d+)/g)) {
      pairs.set(match[1], Number(match[2]))
    }

    expect(pairs.size).toBe(TIME_SLOTS.length)
    for (const slot of TIME_SLOTS) {
      expect(pairs.get(slot.label), `${slot.label} is missing from the migration`).toBe(
        slot.minutes,
      )
    }
  })

  it('enforces one form per side, known labels, and the ordering rule', () => {
    expect(migration).toContain('climbs_window_shape')
    expect(migration).toContain('climbs_slot_labels')
    expect(migration).toContain('climbs_window_order')
    expect(migration).toContain('public.window_minutes(start_time, start_slot)')
  })
})
