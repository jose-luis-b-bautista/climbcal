/**
 * Avatar chip colours.
 *
 * Each climber keeps one of these for good: the hue is derived from their user
 * id, so it is stable across renders and pages (picking at random on every
 * render would flicker), but spreads across the palette instead of everyone
 * being green.
 *
 * The matching `--color-avatar-<hue>` / `--color-avatar-<hue>-ink` tokens live in
 * `src/index.css` (one pair per theme); `theme.test.ts` checks their contrast and
 * that both sides stay in step.
 */
export const AVATAR_HUES = [
  'emerald',
  'sky',
  'violet',
  'fuchsia',
  'rose',
  'amber',
  'teal',
  'indigo',
] as const

export type AvatarHue = (typeof AVATAR_HUES)[number]

/**
 * Written out rather than built from the hue, because Tailwind only sees class
 * names that appear literally in the source.
 */
export const AVATAR_HUE_CLASSES: Record<AvatarHue, string> = {
  emerald: 'bg-avatar-emerald/70 text-avatar-emerald-ink',
  sky: 'bg-avatar-sky/70 text-avatar-sky-ink',
  violet: 'bg-avatar-violet/70 text-avatar-violet-ink',
  fuchsia: 'bg-avatar-fuchsia/70 text-avatar-fuchsia-ink',
  rose: 'bg-avatar-rose/70 text-avatar-rose-ink',
  amber: 'bg-avatar-amber/70 text-avatar-amber-ink',
  teal: 'bg-avatar-teal/70 text-avatar-teal-ink',
  indigo: 'bg-avatar-indigo/70 text-avatar-indigo-ink',
}

/**
 * Stable hue for a climber: the same id always lands on the same colour, and
 * different ids spread across the palette.
 */
export function avatarHueFor(seed: string | null | undefined): AvatarHue {
  const key = seed ?? ''
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    // 31 is the usual small-multiplier hash; the modulus keeps it in integers.
    hash = (hash * 31 + key.charCodeAt(index)) % 1_000_003
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length]
}