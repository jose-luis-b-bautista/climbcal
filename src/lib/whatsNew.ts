/**
 * Release notes behind the "What was updated" pop-up.
 *
 * The newest entry is the one the dialog opens with, and its `id` is what gets
 * stored once someone has read it - so adding an entry with a fresh id is all it
 * takes to show the pop-up again, while a copy tweak on an entry people already
 * saw stays quiet. Keep the highlights to one short line each: this is a pop-up,
 * not a changelog file.
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

/** The release the pop-up opens with, and the one a visit records as read. */
export const WHATS_NEW_LATEST = WHATS_NEW[0]
