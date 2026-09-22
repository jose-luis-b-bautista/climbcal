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
  readableInk,
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

  it('paints the primary as the fill and keeps both brand colours verbatim', () => {
    for (const [name, palette] of Object.entries(GYM_PALETTES)) {
      const cell = gymPaletteOf(name)
      expect(cell).not.toBeNull()
      // The supplied `primary` is the fill, the supplied `background` the outline.
      expect(cell?.fill).toBe(palette.primary)
      expect(cell?.border).toBe(palette.background)
    }
  })

  it('keeps every label readable (AA) on its fill', () => {
    for (const name of Object.keys(GYM_PALETTES)) {
      const cell = gymPaletteOf(name)!
      const ratio = contrastRatio(cell.text, cell.fill)
      expect(ratio, `${name} label is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('never lets a cell disappear: a fill on the dark theme, an outline on the light one', () => {
    for (const name of Object.keys(GYM_PALETTES)) {
      const cell = gymPaletteOf(name)!
      // No black holes: the fill has to lift off the dark page/card.
      const onDark = contrastRatio(cell.fill, '#18181b')
      expect(onDark, `${name} fill vanishes on dark (${onDark.toFixed(2)}:1)`).toBeGreaterThanOrEqual(
        1.3,
      )
      // Some brand fills are pale (the yellows), so in light mode the dark
      // outline is what defines the cell.
      const onLight = Math.max(contrastRatio(cell.fill, '#ffffff'), contrastRatio(cell.border, '#ffffff'))
      expect(onLight, `${name} cell vanishes on light (${onLight.toFixed(2)}:1)`).toBeGreaterThanOrEqual(
        1.3,
      )
    }
  })

  it('leaves an ink that already clears AA exactly as supplied', () => {
    expect(readableInk('#162E5A', '#FAD02C')).toBe('#162E5A')
    expect(gymPaletteOf('BHive')).toEqual({
      fill: '#FAD02C',
      text: '#162E5A',
      border: '#162E5A',
    })
    // Rock On Boulder: primary #FF007F fills the cell, the black becomes the ink.
    expect(gymPaletteOf('Rock On Boulder')).toEqual({
      fill: '#FF007F',
      text: '#000000',
      border: '#000000',
    })
  })

  it('lifts only the ink colour when it could not be read on the fill', () => {
    const flowState = gymPaletteOf('Flow State Bouldering')
    expect(flowState?.fill).toBe('#5B3182')
    expect(flowState?.text).not.toBe('#111827')
    expect(contrastRatio(flowState?.text ?? '', '#5B3182')).toBeGreaterThanOrEqual(4.5)
  })

  it('has no palette for a one-off name, and picks the first gym of an "either"', () => {
    expect(gymPaletteOf('Some Hostel Wall')).toBeNull()
    expect(gymPaletteOf(null)).toBeNull()

    expect(
      gymPaletteFor({ custom_gym_name: 'BHive', custom_gym_name_2: 'Boulder24' })?.fill,
    ).toBe('#FAD02C')
    expect(
      gymPaletteFor({ custom_gym_name: 'Not Listed', gym_2: { name: 'Boulder24' } })?.fill,
    ).toBe('#EF4444')
    expect(gymPaletteFor({})).toBeNull()
  })
})
