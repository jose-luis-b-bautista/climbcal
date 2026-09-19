import { describe, expect, it } from 'vitest'
import { displayNameOf, gymNameOf, initialsOf, normaliseUsername } from './format'
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
    expect(gymNameOf({})).toBe('Gym not set')
  })
})
