/**
 * Route/URL helpers shared by the auth screens and the public share page.
 *
 * They live here, rather than inline, so the one rule that matters is tested in
 * one place: `?next=` arrives from the URL, so a crafted link could otherwise
 * send a visitor off-site right after they typed their password.
 */

/**
 * A same-origin path we are willing to redirect to, or `null` when the value is
 * not one.
 *
 * Absolute (`/x`) is required, and protocol-relative (`//evil.com`) as well as
 * backslash forms (`/\evil.com`, which browsers normalise to `//evil.com`) are
 * rejected.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/**
 * Where a signed-in visitor should land: the `?next=` they arrived with (a share
 * link, say), then the route they were bounced off, then the week view.
 */
export function loginRedirectPath({
  next,
  from,
  fallback = '/week',
}: {
  next?: string | null
  from?: string | null
  fallback?: string
}): string {
  return safeRedirectPath(next) ?? safeRedirectPath(from) ?? fallback
}

/** The public share path for a climber's username: `/u/<username>`. */
export function profileSharePath(username: string): string {
  return `/u/${encodeURIComponent(username)}`
}
