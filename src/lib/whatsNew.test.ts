import { describe, expect, it } from 'vitest'
import { WHATS_NEW, WHATS_NEW_LATEST, WHATS_NEW_STORAGE_KEY } from './whatsNew'

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
