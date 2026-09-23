/**
 * Regression cover for the avatar chip: an emoji in a display name used to be
 * cut mid-surrogate-pair, so "Sam 🧗" rendered as "S�".
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './ui'
import type { Profile } from '../types'

/** A high surrogate or low surrogate that lost its partner — the "�" symptom. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

function profile(fields: Partial<Profile>): Profile {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'climber',
    display_name: null,
    visibility: 'public',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...fields,
  }
}

/** The rendered chip text, as the browser would show it. */
function chipText(fields: Partial<Profile>): string {
  const { container } = render(<Avatar profile={profile(fields)} />)
  return container.firstElementChild?.textContent ?? ''
}

describe('<Avatar />', () => {
  it('renders an emoji from a display name without breaking the glyph', () => {
    const text = chipText({ display_name: 'Sam 🧗' })

    expect(text).toBe('S🧗')
    expect(LONE_SURROGATE.test(text)).toBe(false)
    expect(text).not.toContain('\uFFFD')
  })

  it('keeps multi-code-point emoji whole', () => {
    expect(chipText({ display_name: '🧗🏽' })).toBe('🧗🏽')
    expect(chipText({ display_name: '🧗‍♀️' })).toBe('🧗‍♀️')
    expect(chipText({ display_name: '🇵🇭 Pia' })).toBe('🇵🇭P')
  })

  it('still falls back to letters, and to a question mark with nothing to show', () => {
    expect(chipText({ display_name: 'Luis' })).toBe('LU')
    expect(chipText({ display_name: null, username: null })).toBe('?')
  })
})
