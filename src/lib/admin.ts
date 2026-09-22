/**
 * Gate for the hidden `/admin` route.
 *
 * This is a **convenience lock, not a security boundary**: the bundle is public,
 * so anyone who cares can read the password out of it. What actually protects the
 * data is `profiles.is_admin` + RLS — see
 * `supabase/migrations/20260920000400_admin.sql`. Unlocking the UI as a
 * non-admin gives you a dashboard whose every write the database refuses.
 */
export const ADMIN_PASSWORD = 'ilikepie'

/** Per-tab, so the unlock does not survive closing the browser. */
const UNLOCK_KEY = 'climbcal-admin'

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === 'yes'
  } catch {
    // Storage can be unavailable (private mode); fall back to locked.
    return false
  }
}

export function unlockAdmin(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, 'yes')
  } catch {
    // Nothing to do: the in-memory state still unlocks this render.
  }
}

export function lockAdmin(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY)
  } catch {
    // Same as above.
  }
}