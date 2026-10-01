/**
 * The gym palette is display data that has to match the *seeded* gyms, so the
 * migrations are parsed rather than duplicated (same trick as slots/theme tests).
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GYM_PALETTES, gymPaletteFor, gymPaletteOf } from './gymColors'

/** The regional seed list, then the later one-off additions to it. */
const SEED_MIGRATIONS = [
  'supabase/migrations/20260920000000_gym_regions.sql',
  'supabase/migrations/20260929000000_grava_gym.sql',
]

// Read as one script, so the scan below covers the whole seeded list.
const migration = SEED_MIGRATIONS.map((file) =>
  readFileSync(resolvePath(process.cwd(), file), 'utf8'),
).join('\n')

describe('gym palette', () => {
  it('covers exactly the gyms the seed migrations define', () => {
    const seeded = [...migration.matchAll(/\('([^']+)',\s*'(Luzon|Visayas|Mindanao)'\)/g)].map(
      (match) => match[1],
    )

    expect(seeded.length).toBe(22)
    expect(Object.keys(GYM_PALETTES).sort()).toEqual([...seeded].sort())
  })

  it('paints the primary as the fill and keeps both brand colours verbatim', () => {
    for (const [name, palette] of Object.entries(GYM_PALETTES)) {
      const cell = gymPaletteOf(name)
      expect(cell).not.toBeNull()
      // Verbatim: primary fills, background inks, and one shared black outline.
      expect(cell?.fill).toBe(palette.primary)
      expect(cell?.text).toBe(palette.background)
    }
  })

  it('maps a couple of gyms exactly, verbatim and with no border', () => {
    expect(gymPaletteOf('BHive')).toEqual({ fill: '#3174b4', text: '#fbfcf7' })
    expect(gymPaletteOf('Rock On Boulder')).toEqual({ fill: '#FF007F', text: '#000000' })
  })

  it('has no palette for a one-off name, and picks the first gym of an "either"', () => {
    expect(gymPaletteOf('Some Hostel Wall')).toBeNull()
    expect(gymPaletteOf(null)).toBeNull()

    expect(
      gymPaletteFor({ custom_gym_name: 'BHive', custom_gym_name_2: 'Boulder24' })?.fill,
    ).toBe('#3174b4')
    expect(
      gymPaletteFor({ custom_gym_name: 'Not Listed', gym_2: { name: 'Boulder24' } })?.fill,
    ).toBe('#EF4444')
    expect(gymPaletteFor({})).toBeNull()
  })
})
