/**
 * The gym palette is display data that has to match the *seeded* gyms, so the
 * migration is parsed rather than duplicated (same trick as slots/theme tests).
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GYM_PALETTES,
  contrastRatio,
  gymPaletteFor,
  gymPaletteOf,
  readablePrimary,
} from './gymColors'

const migration = readFileSync(
  resolvePath(process.cwd(), 'supabase/migrations/20260920000000_gym_regions.sql'),
  'utf8',
)

describe('gym palette', () => {
  it('covers exactly the gyms the seed migration defines', () => {
    const seeded = [...migration.matchAll(/\('([^']+)',\s*'(Luzon|Visayas|Mindanao)'\)/g)].map(
      (match) => match[1],
    )

    expect(seeded.length).toBe(21)
    expect(Object.keys(GYM_PALETTES).sort()).toEqual([...seeded].sort())
  })

  it('keeps every cell readable (AA) after the primary is lifted', () => {
    for (const [name, palette] of Object.entries(GYM_PALETTES)) {
      const resolved = gymPaletteOf(name)
      expect(resolved).not.toBeNull()
      const ratio = contrastRatio(resolved?.text ?? '', resolved?.background ?? '')
      expect(ratio, `${name} cell is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      // Both brand colours are kept verbatim: background as given, primary as the border.
      expect(resolved?.background).toBe(palette.background)
      expect(resolved?.border).toBe(palette.primary)
    }
  })

  it('leaves a primary that already clears AA exactly as supplied', () => {
    expect(readablePrimary('#FAD02C', '#162E5A')).toBe('#FAD02C')
    expect(gymPaletteOf('BHive')).toEqual({
      text: '#FAD02C',
      background: '#162E5A',
      border: '#FAD02C',
    })
  })

  it('lifts only the text colour when the primary could not be read', () => {
    const flowState = gymPaletteOf('Flow State Bouldering')
    expect(flowState?.text).not.toBe('#5B3182')
    expect(flowState?.border).toBe('#5B3182')
    expect(contrastRatio(flowState?.text ?? '', '#111827')).toBeGreaterThanOrEqual(4.5)
  })

  it('has no palette for a one-off name, and picks the first gym of an "either"', () => {
    expect(gymPaletteOf('Some Hostel Wall')).toBeNull()
    expect(gymPaletteOf(null)).toBeNull()

    expect(gymPaletteFor({ custom_gym_name: 'BHive', custom_gym_name_2: 'Boulder24' })?.background).toBe(
      '#162E5A',
    )
    expect(gymPaletteFor({ custom_gym_name: 'Not Listed', gym_2: { name: 'Boulder24' } })?.background).toBe(
      '#1E293B',
    )
    expect(gymPaletteFor({})).toBeNull()
  })
})
