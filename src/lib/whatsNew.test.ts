import { describe, expect, it } from 'vitest'
import {
  WHATS_NEW,
  WHATS_NEW_LATEST,
  WHATS_NEW_STORAGE_KEY,
  unreadWhatsNew,
  type WhatsNewEntry,
} from './whatsNew'

describe('release notes', () => {
  it('opens on the newest release, with unique ids', () => {
    expect(WHATS_NEW_LATEST).toBe(WHATS_NEW[0])

    const ids = WHATS_NEW.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every entry readable', () => {
    for (const entry of WHATS_NEW) {
      // A dated id - bumping it is what re-opens the pop-up.
      expect(entry.id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/)
      expect(entry.date.trim().length).toBeGreaterThan(0)
      expect(entry.highlights.length).toBeGreaterThan(0)
      // One line each: a pop-up, not a changelog file.
      for (const highlight of entry.highlights) {
        expect(highlight.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('records what was read under one stable key', () => {
    expect(WHATS_NEW_STORAGE_KEY).toBe('climbcal-whats-new-seen')
  })
})

describe('unreadWhatsNew', () => {
  // A three-release history, so "everything above the marker" is more than one.
  const entries: WhatsNewEntry[] = [
    { id: '2026-11-10-third', date: '10 November 2026', highlights: ['third release note here'] },
    { id: '2026-11-09-second', date: '9 November 2026', highlights: ['second release note here'] },
    { id: '2026-09-01-first', date: '1 September 2026', highlights: ['first release note here'] },
  ]

  it('shows every release on a first visit, or for a marker it no longer knows', () => {
    // Nothing stored, or an id we cannot place: assume nothing was read.
    expect(unreadWhatsNew(null, entries)).toEqual(entries)
    expect(unreadWhatsNew(undefined, entries)).toEqual(entries)
    expect(unreadWhatsNew('2020-01-01-long-gone', entries)).toEqual(entries)
  })

  it('is quiet once the newest release has been read', () => {
    expect(unreadWhatsNew(entries[0].id, entries)).toEqual([])
  })

  it('returns every release above the last one read, newest first', () => {
    expect(unreadWhatsNew(entries[2].id, entries)).toEqual([entries[0], entries[1]])
    expect(unreadWhatsNew(entries[1].id, entries)).toEqual([entries[0]])
  })

  it('reads the shipped list by default', () => {
    expect(unreadWhatsNew(WHATS_NEW[1].id)).toEqual(WHATS_NEW.slice(0, 1))
    expect(unreadWhatsNew(null)).toEqual(WHATS_NEW)
  })
})
