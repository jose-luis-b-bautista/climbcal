import { describe, expect, it } from 'vitest'
import {
  GYM_REGIONS,
  OTHER_REGION_LABEL,
  displayNameOf,
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
