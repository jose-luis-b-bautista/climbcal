import type { Profile } from '../types'

/** Best available human label for a profile: display name, then @username. */
export function displayNameOf(profile: Profile | null | undefined): string {
  if (!profile) return 'Unknown climber'
  return profile.display_name?.trim() || (profile.username ? `@${profile.username}` : 'Unknown climber')
}

/** The `@handle` for a profile, or null when it has none. */
export function usernameOf(profile: Profile | null | undefined): string | null {
  const username = profile?.username?.trim()
  return username ? `@${username}` : null
}

/**
 * Text split into user-perceived characters.
 *
 * Indexing a string by code unit is what breaks emoji: they occupy two code
 * units (a surrogate pair), so `name[0]` can return half of one and the browser
 * paints the "�" replacement box. `Intl.Segmenter` keeps flags ("🇵🇭"),
 * skin-tone variants ("🧗🏽") and ZWJ families ("👨‍👩‍👧") in one piece; the
 * `Array.from` fallback (Safari before 16.4) at least keeps whole code points.
 */
let graphemeSegmenter: Intl.Segmenter | null | undefined

export function graphemes(value: string): string[] {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null
  }

  if (!graphemeSegmenter) return Array.from(value)
  return [...graphemeSegmenter.segment(value)].map((piece) => piece.segment)
}

/** A letter or a digit — the only characters worth pairing up into initials. */
const INITIAL_LETTER = /[\p{L}\p{N}]/u

/**
 * Initials for the avatar bubble, cut on grapheme boundaries so emoji survive.
 *
 * - one word → its first two characters ("Luis" → "LU"), or the emoji alone when
 *   the word *is* an emoji ("🧗🏽" → "🧗🏽")
 * - several words → first character of the first and last word ("Ana Maria" →
 *   "AM", "Sam 🧗" → "S🧗")
 */
export function initialsOf(profile: Profile | null | undefined): string {
  if (!profile) return '?'
  const source = profile.display_name?.trim() || profile.username?.trim() || ''
  if (!source) return '?'

  const words = source.split(/\s+/).filter(Boolean).map(graphemes)

  if (words.length === 1) {
    const [first, second] = words[0]
    // Pair up two letters/digits only, so an emoji is never joined to a stub.
    const pair = second && INITIAL_LETTER.test(first) && INITIAL_LETTER.test(second)
    return (pair ? `${first}${second}` : first).toUpperCase()
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

/** Gym names on a climb, in slot order: a linked gym, else the typed fallback. */
export function climbGymNames(climb: {
  custom_gym_name?: string | null
  gym?: { name: string } | null
  custom_gym_name_2?: string | null
  gym_2?: { name: string } | null
}): string[] {
  return [
    climb.gym?.name ?? climb.custom_gym_name?.trim(),
    climb.gym_2?.name ?? climb.custom_gym_name_2?.trim(),
  ].filter((name): name is string => Boolean(name))
}

/** Gym label for a climb: linked gym name, else the free-text fallback. */
export function gymNameOf(climb: {
  custom_gym_name?: string | null
  gym?: { name: string } | null
  custom_gym_name_2?: string | null
  gym_2?: { name: string } | null
}): string {
  const names = climbGymNames(climb)

  if (names.length === 0) return 'Not sure yet'
  if (names.length === 1) return names[0]
  return `Either ${names[0]} or ${names[1]}`
}

/** Island regions the seeded gym list is grouped by, in display order. */
export const GYM_REGIONS = ['Luzon', 'Visayas', 'Mindanao']

/** Bucket label for gyms with no region, or one outside {@link GYM_REGIONS}. */
export const OTHER_REGION_LABEL = 'Other'

export interface GymGroup<T> {
  region: string
  gyms: T[]
}

/**
 * Groups gyms for display: the canonical regions in {@link GYM_REGIONS} order
 * first, then any custom region alphabetically, and the "Other" bucket for
 * untagged gyms last. Empty buckets are never emitted.
 */
export function groupGymsByRegion<T extends { region?: string | null }>(
  gyms: T[],
): GymGroup<T>[] {
  const buckets = new Map<string, T[]>()

  for (const gym of gyms) {
    const region = gym.region?.trim() || OTHER_REGION_LABEL
    const bucket = buckets.get(region)
    if (bucket) bucket.push(gym)
    else buckets.set(region, [gym])
  }

  const canonical = GYM_REGIONS.filter((region) => buckets.has(region))
  const custom = [...buckets.keys()]
    .filter((region) => !canonical.includes(region) && region !== OTHER_REGION_LABEL)
    .sort((a, b) => a.localeCompare(b))
  const other = buckets.has(OTHER_REGION_LABEL) ? [OTHER_REGION_LABEL] : []

  return [...canonical, ...custom, ...other].map((region) => ({
    region,
    gyms: buckets.get(region) ?? [],
  }))
}

/** Normalise user input into a valid username, or return the error message. */
export function normaliseUsername(raw: string): { value: string } | { error: string } {
  const value = raw.trim().toLowerCase().replace(/^@/, '')
  if (value.length < 3) return { error: 'Username must be at least 3 characters.' }
  if (value.length > 24) return { error: 'Username must be 24 characters or fewer.' }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return { error: 'Usernames can only use letters, numbers and underscores.' }
  }
  return { value }
}
