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
export function gymNameOf(
  climb: { custom_gym_name?: string | null; gym?: { name: string } | null },
): string {
  return climb.gym?.name ?? climb.custom_gym_name?.trim() ?? 'Gym not set'
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
