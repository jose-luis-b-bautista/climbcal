import type { Profile } from '../types'

/** Best available human label for a profile: display name, then @username. */
export function displayNameOf(profile: Profile | null | undefined): string {
  if (!profile) return 'Unknown climber'
  return profile.display_name?.trim() || (profile.username ? `@${profile.username}` : 'Unknown climber')
}

/** Initials for the avatar bubble. */
export function initialsOf(profile: Profile | null | undefined): string {
  if (!profile) return '?'
  const source = profile.display_name?.trim() || profile.username?.trim() || ''
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Gym label for a climb: linked gym name, else the free-text fallback. */
export function gymNameOf(climb: {
  custom_gym_name?: string | null
  gym?: { name: string } | null
  custom_gym_name_2?: string | null
  gym_2?: { name: string } | null
}): string {
  const names = [
    climb.gym?.name ?? climb.custom_gym_name?.trim(),
    climb.gym_2?.name ?? climb.custom_gym_name_2?.trim(),
  ].filter((name): name is string => Boolean(name))

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
