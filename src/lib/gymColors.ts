import { climbGymNames } from './format'

/**
 * Per-gym brand colours, used **exactly as supplied**: `primary` fills the cell,
 * `background` is the label ink, and every cell shares a black outline.
 *
 * Nothing is contrast-corrected here. Several of these pairs are low-contrast by
 * WCAG (Rock On Boulder #000000 on #FF007F is fine, Good Climbs PH #0F172A on
 * #2A52BE is not), and that is deliberate for now — what is on screen is the
 * palette verbatim, so it can be edited in one place and seen immediately.
 * `gymColors.test.ts` checks the mapping and that both colours reach the cell
 * untouched.
 */
/** The colours a gym cell renders with: the gym's own pair, verbatim. */
export interface GymCellColors {
  /** The gym's `primary`, used as the cell's fill. */
  fill: string
  /** The gym's `background`, used as the label ink. */
  text: string
  /** The shared black outline. */
  border: string
}

/** Every gym cell is outlined in black, so it has an edge on any fill or theme. */
export const GYM_CELL_BORDER = '#000000'

/** Exactly the gyms seeded by 20260920000000_gym_regions.sql. */
export const GYM_PALETTES: Record<string, { primary: string; background: string }> = {
  // Luzon
  'Boulder Space': { primary: '#00A896', background: '#0B132B' },
  'Climb Central Manila': { primary: '#E75A24', background: '#1A365D' },
  BHive: { primary: '#FAD02C', background: '#162E5A' },
  GHive: { primary: '#FAD02C', background: '#162E5A' },
  'Edge Climb': { primary: '#FF4500', background: '#2C3E50' },
  'Boulder World': { primary: '#E53E3E', background: '#2D3748' },
  'Good Climbs PH': { primary: '#2A52BE', background: '#0F172A' },
  'Power Up TS': { primary: '#FFC72C', background: '#1A1A1A' },
  'Power Up Centro': { primary: '#FFC72C', background: '#1A1A1A' },
  'Power Up Alabang': { primary: '#FFC72C', background: '#1A1A1A' },
  'Flow State Bouldering': { primary: '#5B3182', background: '#111827' },
  'Urban Peak Wall Climbing': { primary: '#FF5722', background: '#1E1E1E' },
  // Visayas
  'Rock On Boulder': { primary: '#FF007F', background: '#000000' },
  'Vertex Bouldering': { primary: '#4F46E5', background: '#0F172A' },
  'Iloilo Adventure Central': { primary: '#008080', background: '#1A202C' },
  'The Pump Factory': { primary: '#DC2626', background: '#0F172A' },
  'Puroc Climbing': { primary: '#FFC72C', background: '#334155' },
  'Greyhound Climbing': { primary: '#FFB703', background: '#1D3557' },
  // Mindanao
  Boulder24: { primary: '#EF4444', background: '#1E293B' },
  'Guru Rock Climbing': { primary: '#7C3AED', background: '#1F2937' },
  'Climb Anytime': { primary: '#10B981', background: '#0F172A' },
}

/**
 * The cell for a gym: its `primary` as the fill, its `background` as the ink,
 * and the shared black outline. No adjustment in either direction.
 */
export function gymPaletteOf(name: string | null | undefined): GymCellColors | null {
  const palette = name ? GYM_PALETTES[name.trim()] : undefined
  if (!palette) return null
  return {
    fill: palette.primary,
    text: palette.background,
    border: GYM_CELL_BORDER,
  }
}

/** First gym on the climb that has a palette (so "either" cells take its look). */
export function gymPaletteFor(climb: Parameters<typeof climbGymNames>[0]): GymCellColors | null {
  for (const name of climbGymNames(climb)) {
    const palette = gymPaletteOf(name)
    if (palette) return palette
  }
  return null
}
