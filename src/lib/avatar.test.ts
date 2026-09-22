import { describe, expect, it } from 'vitest'
import { AVATAR_HUES, AVATAR_HUE_CLASSES, avatarHueFor } from './avatar'

describe('avatarHueFor', () => {
  it('gives the same climber the same colour every time', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    expect(avatarHueFor(id)).toBe(avatarHueFor(id))
    expect(AVATAR_HUES).toContain(avatarHueFor(id))
  })

  it('spreads climbers across the whole palette', () => {
    const ids = Array.from({ length: 64 }, (_, index) => `climber-${index}`)
    expect(new Set(ids.map(avatarHueFor)).size).toBe(AVATAR_HUES.length)
  })

  it('does not lump realistic uuids onto one colour', () => {
    const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666']
    expect(new Set(ids.map(avatarHueFor)).size).toBeGreaterThanOrEqual(4)
  })

  it('still returns a palette colour for a missing profile', () => {
    expect(AVATAR_HUES).toContain(avatarHueFor(null))
    expect(AVATAR_HUES).toContain(avatarHueFor(undefined))
  })
})

describe('AVATAR_HUE_CLASSES', () => {
  it('names the chip and ink tokens for every hue', () => {
    expect(Object.keys(AVATAR_HUE_CLASSES)).toHaveLength(AVATAR_HUES.length)
    for (const hue of AVATAR_HUES) {
      expect(AVATAR_HUE_CLASSES[hue]).toContain(`bg-avatar-${hue}`)
      expect(AVATAR_HUE_CLASSES[hue]).toContain(`text-avatar-${hue}-ink`)
    }
  })
})