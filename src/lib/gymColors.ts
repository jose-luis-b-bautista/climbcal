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
}


/** Exactly the gyms seeded by 20260920000000_gym_regions.sql. */
export const GYM_PALETTES: Record<string, { primary: string; background: string }> = {
  // Luzon
  'Boulder Space': { primary: '#0B132B', background: '#00A896' },
  'Climb Central Manila': { primary: '#f37427', background: '#fbfcf7' },
  BHive: { primary: '#3174b4', background: '#fbfcf7' },
  GHive: { primary: '#0c4b7c', background: '#fbfcf7' },
  'Edge Climb': { primary: '#111135', background: '#fbfcf7' },
  'Boulder World': { primary: '#1ea18f', background: '#0e606c' },
  'Good Climbs PH': { primary: '#78bc3f', background: '#f4debe' },
  'Power Up TS': { primary: '#FFC72C', background: '#1A1A1A' },
  'Power Up Centro': { primary: '#FFC72C', background: '#1A1A1A' },
  'Power Up Alabang': { primary: '#FFC72C', background: '#1A1A1A' },
  'Flow State Bouldering': { primary: '#5B3182', background: '#f5c034' },
  'Urban Peak Wall Climbing': { primary: '#008506', background: '#000000' },
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
