/**
 * Release notes behind the "What was updated" pop-up.
 *
 * Entries are newest-first. The id of the newest *read* release is what gets
 * stored, and the pop-up shows every entry above it - so a device that skipped a
 * deploy sees both releases in one go, while a copy tweak on notes people
 * already read stays quiet. Keep the highlights to one short line each: this is a
 * pop-up, not a changelog file.
 */
export interface WhatsNewEntry {
  /** Stable release id. Change it to re-open the pop-up for everyone. */
  id: string
  /** Shown under the title, e.g. "9 November 2026". */
  date: string
  /** What changed, most interesting first - written as plain one-liners. */
  highlights: string[]
}

/** Must match the key read by the `useWhatsNew` provider. */
export const WHATS_NEW_STORAGE_KEY = 'climbcal-whats-new-seen'

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-11-10-comments-walls',
    date: '10 November 2026',
    highlights: [
      'Comment on a session to sort out who is coming',
      'Every climber now has a wall - leave them a note',
      'Delete your own comments, or any on your session',
    ],
  },
  {
    id: '2026-11-09-share-stats-feed',
    date: '9 November 2026',
    highlights: [
      'Added a share week button which you can use to post on ig',
      'Added new stats/data viz',
      'Feed has a view all days button',
      'Adding a session tomorrow is easier now',
      'Removed text bloat lol sorry',
    ],
  },
]

/**
 * The releases a device has not read yet, newest first.
 *
 * The stored marker is one id, meaning "read up to and including this release".
 * So:
 * - no marker, or an id that is no longer in the list (history pruned) → just the
 *   newest release. A brand-new device gets the current notes, not the archive;
 * - a known marker → every release above it, which is usually one or two.
 */
export function unreadWhatsNew(
  seenId: string | null | undefined,
  entries: WhatsNewEntry[] = WHATS_NEW,
): WhatsNewEntry[] {
  if (!seenId) return entries.slice(0, 1)

  const index = entries.findIndex((entry) => entry.id === seenId)
  if (index <= 0) return index === 0 ? [] : entries.slice(0, 1)

  return entries.slice(0, index)
}

/** The release the pop-up opens with, and the one a visit records as read. */
export const WHATS_NEW_LATEST = WHATS_NEW[0]
