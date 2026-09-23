import { describe, expect, it, vi } from 'vitest'
import {
  GYM_REGIONS,
  OTHER_REGION_LABEL,
  climbGymNames,
  displayNameOf,
  graphemes,
  groupGymsByRegion,
  gymNameOf,
  initialsOf,
  normaliseUsername,
  usernameOf,
} from './format'
import type { Profile } from '../types'

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    username: null,
    display_name: null,
    visibility: 'private',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

/** A high surrogate or low surrogate that lost its partner — the "�" symptom. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

describe('normaliseUsername', () => {
  it('lowercases, trims and strips a leading @', () => {
    expect(normaliseUsername('  @Luis_Climbs ')).toEqual({ value: 'luis_climbs' })
  })

  it('rejects short, long and non-slug usernames', () => {
    expect(normaliseUsername('ab')).toHaveProperty('error')
    expect(normaliseUsername('a'.repeat(25))).toHaveProperty('error')
    expect(normaliseUsername('luis climbs')).toHaveProperty('error')
    expect(normaliseUsername('luis!')).toHaveProperty('error')
  })
})

describe('displayNameOf', () => {
  it('prefers the display name, then the handle', () => {
    expect(displayNameOf(makeProfile({ display_name: 'Luis', username: 'luis' }))).toBe('Luis')
    expect(displayNameOf(makeProfile({ username: 'luis' }))).toBe('@luis')
    expect(displayNameOf(null)).toBe('Unknown climber')
  })
})

describe('usernameOf', () => {
  it('gives the @handle when there is one', () => {
    expect(usernameOf(makeProfile({ username: 'luis' }))).toBe('@luis')
    expect(usernameOf(makeProfile({ display_name: 'Luis' }))).toBeNull()
    expect(usernameOf(null)).toBeNull()
  })
})

describe('initialsOf', () => {
  it('uses two letters for one word and both initials for two', () => {
    expect(initialsOf(makeProfile({ display_name: 'Luis' }))).toBe('LU')
    expect(initialsOf(makeProfile({ display_name: 'Ana Maria' }))).toBe('AM')
    expect(initialsOf(makeProfile({ username: 'mara' }))).toBe('MA')
    expect(initialsOf(makeProfile())).toBe('?')
  })

  it('keeps an emoji whole instead of cutting its surrogate pair', () => {
    // Regression: "Sam 🧗" used to render as "S�", because JS string indexing is
    // by UTF-16 code unit, so the second word contributed half a surrogate pair.
    expect(initialsOf(makeProfile({ display_name: 'Sam 🧗' }))).toBe('S🧗')
    expect(initialsOf(makeProfile({ display_name: '🧗 Luis' }))).toBe('🧗L')
  })

  it('keeps emoji that span several code points intact', () => {
    // Flag, skin tone and ZWJ family sequences are 4–7 code units each.
    expect(initialsOf(makeProfile({ display_name: '🇵🇭 Pia' }))).toBe('🇵🇭P')
    expect(initialsOf(makeProfile({ display_name: '🧗🏽' }))).toBe('🧗🏽')
    expect(initialsOf(makeProfile({ display_name: '👨‍👩‍👧 Family' }))).toBe('👨‍👩‍👧F')
    expect(initialsOf(makeProfile({ display_name: '🏔️ Ridge' }))).toBe('🏔️R')
    // The climber + gender sign ZWJ sequence, which is the obvious one for here.
    expect(initialsOf(makeProfile({ display_name: '🧗‍♀️ Ana' }))).toBe('🧗‍♀️A')
    // Keycap sequences (digit + variation selector + enclosing key).
    expect(initialsOf(makeProfile({ display_name: '1️⃣ One' }))).toBe('1️⃣O')
  })

  it('pairs two letters, but stands alone for anything else', () => {
    expect(initialsOf(makeProfile({ display_name: 'A.' }))).toBe('A')
    // Non-Latin letters still pair up; the check is "letter or digit".
    expect(initialsOf(makeProfile({ display_name: '李 明' }))).toBe('李明')
    expect(initialsOf(makeProfile({ display_name: '7 8' }))).toBe('78')
  })

  it('never emits a lone surrogate or a replacement character', () => {
    const names = ['Sam 🧗', '🧗🏽', '🇵🇭', '👨‍👩‍👧', 'Luis', 'Ana Maria 🧗🏽', '🏔️ Ridge', 'A.']

    for (const name of names) {
      const initials = initialsOf(makeProfile({ display_name: name }))
      expect(LONE_SURROGATE.test(initials)).toBe(false)
      expect(initials).not.toContain('\uFFFD')
    }
  })
})

describe('graphemes', () => {
  it('splits on user-perceived characters', () => {
    expect(graphemes('ab')).toEqual(['a', 'b'])
    expect(graphemes('🧗')).toEqual(['🧗'])
    expect(graphemes('🧗🏽')).toEqual(['🧗🏽'])
    expect(graphemes('🇵🇭')).toEqual(['🇵🇭'])
    expect(graphemes('👨‍👩‍👧')).toEqual(['👨‍👩‍👧'])
  })

  it('falls back to whole code points without Intl.Segmenter', async () => {
    // Simulates an older browser against a *fresh* copy of the module: the
    // segmenter is cached per module instance, so reset before importing.
    const mutableIntl = Intl as unknown as { Segmenter?: unknown }
    const original = mutableIntl.Segmenter
    vi.resetModules()
    delete mutableIntl.Segmenter

    try {
      const fresh = await import('./format')
      const parts = fresh.graphemes('a🧗b')

      // The fallback is code points, so the skin-tone case degrades — but no
      // surrogate half is ever handed to the browser.
      expect(parts).toEqual(['a', '🧗', 'b'])
      expect(LONE_SURROGATE.test(parts.join(''))).toBe(false)
    } finally {
      mutableIntl.Segmenter = original
    }
  })
})

describe('gymNameOf', () => {
  it('prefers the linked gym, then the custom name', () => {
    expect(gymNameOf({ gym: { name: 'Vertical Hub' }, custom_gym_name: 'Ignored' })).toBe(
      'Vertical Hub',
    )
    expect(gymNameOf({ gym: null, custom_gym_name: 'Boulder Barn' })).toBe('Boulder Barn')
  })

  it('reads a second gym as "either"', () => {
    expect(gymNameOf({ gym: { name: 'Boulder Space' }, gym_2: { name: 'BHive' } })).toBe(
      'Either Boulder Space or BHive',
    )
    expect(
      gymNameOf({ gym: { name: 'Boulder Space' }, custom_gym_name_2: '  Boulder Barn  ' }),
    ).toBe('Either Boulder Space or Boulder Barn')
    expect(gymNameOf({ gym_2: { name: 'GHive' } })).toBe('GHive')
  })

  it('falls back to "Not sure yet" when no gym is set', () => {
    expect(gymNameOf({})).toBe('Not sure yet')
    expect(gymNameOf({ gym: null, custom_gym_name: '   ' })).toBe('Not sure yet')
  })
})

describe('climbGymNames', () => {
  it('lists both slots in order, trimming typed names', () => {
    expect(climbGymNames({ gym: { name: 'BHive' }, gym_2: { name: 'Edge Climb' } })).toEqual([
      'BHive',
      'Edge Climb',
    ])
    expect(climbGymNames({ custom_gym_name: '  Boulder Barn ', gym_2: { name: 'GHive' } })).toEqual([
      'Boulder Barn',
      'GHive',
    ])
    expect(climbGymNames({})).toEqual([])
  })
})

describe('groupGymsByRegion', () => {
  function gym(name: string, region: string | null) {
    return { name, region }
  }

  it('orders the canonical regions, then custom ones, then Other', () => {
    const groups = groupGymsByRegion([
      gym('Boulder24', 'Mindanao'),
      gym('Cordillera Club', 'Cordillera'),
      gym('Boulder Space', 'Luzon'),
      gym('Rock On Boulder', 'Visayas'),
      gym('Batanes Wall', 'Batanes'),
      gym('One-off', null),
    ])

    expect(GYM_REGIONS).toEqual(['Luzon', 'Visayas', 'Mindanao'])
    expect(groups.map((group) => group.region)).toEqual([
      'Luzon',
      'Visayas',
      'Mindanao',
      'Batanes',
      'Cordillera',
      OTHER_REGION_LABEL,
    ])
    expect(groups[0].gyms.map((item) => item.name)).toEqual(['Boulder Space'])
    expect(groups[groups.length - 1].gyms.map((item) => item.name)).toEqual(['One-off'])
  })

  it('treats blank regions as Other and drops empty buckets', () => {
    const groups = groupGymsByRegion([gym('Blank', '   '), gym('Luzon gym', 'Luzon')])

    expect(groups.map((group) => group.region)).toEqual(['Luzon', OTHER_REGION_LABEL])
  })

  it('returns nothing for an empty gym list', () => {
    expect(groupGymsByRegion([])).toEqual([])
  })
})
