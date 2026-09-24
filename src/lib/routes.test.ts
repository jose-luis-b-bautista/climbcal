/**
 * `?next=` arrives from the URL, so these helpers are the only thing standing
 * between a crafted share link and a visitor being bounced off-site right after
 * typing their password. The rejection cases matter more than the happy path.
 */
import { describe, expect, it } from 'vitest'
import { loginRedirectPath, profileSharePath, safeRedirectPath } from './routes'

describe('safeRedirectPath', () => {
  it('accepts same-origin absolute paths', () => {
    expect(safeRedirectPath('/u/luis')).toBe('/u/luis')
    expect(safeRedirectPath('/week?week=2026-09-14')).toBe('/week?week=2026-09-14')
  })

  it('rejects anything that would leave the origin', () => {
    expect(safeRedirectPath('https://evil.example')).toBeNull()
    // Protocol-relative, and the backslash form browsers normalise into it.
    expect(safeRedirectPath('//evil.example')).toBeNull()
    expect(safeRedirectPath('/\\evil.example')).toBeNull()
    // Relative, empty and missing values are all unusable.
    expect(safeRedirectPath('u/luis')).toBeNull()
    expect(safeRedirectPath('')).toBeNull()
    expect(safeRedirectPath(null)).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
  })
})

describe('loginRedirectPath', () => {
  it('prefers ?next= (a share link), then the route we were bounced off', () => {
    expect(loginRedirectPath({ next: '/u/luis', from: '/week' })).toBe('/u/luis')
    expect(loginRedirectPath({ next: null, from: '/friends' })).toBe('/friends')
    expect(loginRedirectPath({})).toBe('/week')
  })

  it('falls back when ?next= is not a safe path', () => {
    expect(loginRedirectPath({ next: '//evil.example', from: '/feed' })).toBe('/feed')
    expect(loginRedirectPath({ next: 'https://evil.example', from: null })).toBe('/week')
    expect(loginRedirectPath({ next: 'https://evil.example', fallback: '/login' })).toBe('/login')
  })
})

describe('profileSharePath', () => {
  it('builds the public share path, escaping the username', () => {
    expect(profileSharePath('luis')).toBe('/u/luis')
    expect(profileSharePath('a b')).toBe('/u/a%20b')
  })
})
