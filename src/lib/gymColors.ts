import { climbGymNames } from './format'

/**
 * Per-gym brand colours, straight from the gyms. Each pair is used *swapped*
 * from how it is named here: `primary` is the vivid brand colour and becomes the
 * cell's fill, while `background` is the gym's dark tone and becomes the ink —
 * otherwise cells like Rock On Boulder (background `#000000`) are black holes on
 * the dark theme.
 *
 * Five of the pairs are still below WCAG AA (4.5:1) that way round (Good Climbs
 * PH 2.6:1, Flow State Bouldering 1.9:1, …), so {@link readableInk} derives a
 * readable *ink* from the supplied `background`, leaving both brand colours
 * untouched as the fill and the outline. `gymColors.test.ts` asserts every cell
 * clears AA, stays visible on both themes, and keeps both colours verbatim.
 */
/** The colours a gym cell actually renders with. */
export interface GymCellColors {
  /** The gym's `primary` — the cell's fill, and its brand colour on screen. */
  fill: string
  /** The gym's `background` used as ink, lightened only if it could not be read. */
  text: string
  /** The gym's `background`, untouched — the cell's outline. */
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

function mix(from: string, to: string, amount: number): string {
  const fromParts = [1, 3, 5].map((offset) => parseInt(from.slice(offset, offset + 2), 16))
  const toParts = [1, 3, 5].map((offset) => parseInt(to.slice(offset, offset + 2), 16))
  const mixed = fromParts.map((part, index) => Math.round(part + (toParts[index] - part) * amount))
  return `#${mixed.map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The ink for a cell: the supplied colour, or — if it cannot be read on that
 * fill — the same hue moved toward white on a dark fill and toward black on a
 * light one, in 2% steps, until it clears AA.
 *
 * Both directions are needed: a brand fill like Climb Central Manila's
 * `#E75A24` is light enough that even white only manages 3.4:1, so darkening the
 * ink is the only way to reach AA there.
 */
export function readableInk(ink: string, fill: string): string {
  if (contrastRatio(ink, fill) >= MIN_CONTRAST) return ink

  const towards = luminance(fill) < 0.18 ? '#ffffff' : '#000000'
  for (let step = 1; step <= 50; step += 1) {
    const candidate = mix(ink, towards, step / 50)
    if (contrastRatio(candidate, fill) >= MIN_CONTRAST) return candidate
  }
  return towards
}

/**
 * The cell for a gym: its `primary` as the fill, its `background` as the ink and
 * outline — swapped from the way the pair is named, because in this palette the
 * primaries are the vivid brand colours and the backgrounds are the dark tones.
 */
export function gymPaletteOf(name: string | null | undefined): GymCellColors | null {
  const palette = name ? GYM_PALETTES[name.trim()] : undefined
  if (!palette) return null
  return {
    fill: palette.primary,
    text: readableInk(palette.background, palette.primary),
    border: palette.background,
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
