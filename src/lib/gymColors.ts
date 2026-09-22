import { climbGymNames } from './format'

/**
 * Per-gym brand colours: `primary` is the label text and border, `background`
 * the cell behind it. The values are the gyms' own, supplied as-is.
 *
 * Ten of the supplied pairs are below WCAG AA (4.5:1) for text — two are close
 * to invisible (Good Climbs PH 2.6:1, Flow State Bouldering 1.9:1) — so
 * {@link readablePrimary} derives a readable *text* colour, leaving the brand
 * background and the primary-as-border exactly as supplied.
 * `gymColors.test.ts` asserts every cell clears AA.
 */
/** The colours a gym cell actually renders with. */
export interface GymCellColors {
  /** Label text: the brand primary, lightened only if it could not be read. */
  text: string
  /** The brand background, untouched. */
  background: string
  /** The brand primary, untouched — the cell's border. */
  border: string
}

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

/** Below this, normal-size text stops being reasonably readable. */
const MIN_CONTRAST = 4.5

function channelToLinear(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

function mixTowardsWhite(hex: string, amount: number): string {
  const parts = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  const mixed = parts.map((part) => Math.round(part + (255 - part) * amount))
  return `#${mixed.map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The primary colour, unless it cannot be read on the background — then the
 * same hue lightened in 2% steps until it clears AA.
 */
export function readablePrimary(primary: string, background: string): string {
  if (contrastRatio(primary, background) >= MIN_CONTRAST) return primary

  for (let step = 1; step <= 50; step += 1) {
    const candidate = mixTowardsWhite(primary, step / 50)
    if (contrastRatio(candidate, background) >= MIN_CONTRAST) return candidate
  }
  return '#ffffff'
}

/** The cell colours for a gym name, or null when the gym has no palette yet. */
export function gymPaletteOf(name: string | null | undefined): GymCellColors | null {
  const palette = name ? GYM_PALETTES[name.trim()] : undefined
  if (!palette) return null
  return {
    text: readablePrimary(palette.primary, palette.background),
    background: palette.background,
    border: palette.primary,
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
