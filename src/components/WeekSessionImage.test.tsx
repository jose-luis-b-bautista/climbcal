/**
 * The share image is generated as a logo-free SVG string, so its palette can be
 * asserted directly: the same sessions must come out on the app's dark tokens
 * when the app is dark, and on the light tokens when it is light.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeekSessionImage, generateWeekSessionSVG } from './WeekSessionImage'
import type { ClimbEntry } from '../types'

const profile = {
  id: 'user-1',
  username: 'luis',
  display_name: 'Luis',
  visibility: 'public' as const,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
}

function entry(overrides: Partial<ClimbEntry> = {}): ClimbEntry {
  return {
    id: 'climb-1',
    user_id: 'user-1',
    climb_date: '2026-09-16',
    start_time: '18:30:00',
    end_time: '21:00:00',
    start_slot: null,
    end_slot: null,
    gym_id: 'gym-1',
    custom_gym_name: null,
    gym_id_2: null,
    custom_gym_name_2: null,
    note: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    gym: { id: 'gym-1', name: 'Vertical Hub' },
    gym_2: null,
    climber: profile,
    ...overrides,
  }
}

const sessions = [entry()]

describe('generateWeekSessionSVG', () => {
  it('paints the dark palette when the app is dark', () => {
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'Luis', 'dark')

    expect(svg).toContain('width="1080"')
    expect(svg).toContain('height="1920"')
    // Page + card/accent tokens from the dark theme.
    expect(svg).toContain('fill="#09090b"')
    expect(svg).toContain('fill="#10b981"')
    expect(svg).not.toContain('fill="#fafafa"')
  })

  it('paints the light palette when the app is light', () => {
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'Luis', 'light')

    // Page goes zinc-950 light, accents go emerald-600 light.
    expect(svg).toContain('fill="#fafafa"')
    expect(svg).toContain('fill="#065f46"')
    expect(svg).not.toContain('fill="#09090b"')
  })

  it('lists each climb with its day, gym and time window', () => {
    const svg = generateWeekSessionSVG(
      [entry(), entry({ id: 'climb-2', climb_date: '2026-09-18', start_time: '07:00:00', end_time: '09:30:00' })],
      'Sep 14 – Sep 20',
      'Luis',
      'dark',
    )

    expect(svg).toContain('Wednesday')
    expect(svg).toContain('Friday')
    expect(svg).toContain('Vertical Hub')
    expect(svg).toContain('18:30 – 21:00')
    expect(svg).toContain('07:00 – 09:30')
  })

  it('escapes user text so `&` cannot break the SVG', () => {
    const svg = generateWeekSessionSVG(
      [entry({ gym: { id: 'gym-2', name: 'Rock & Roll' }, note: 'A < B' })],
      'Sep 14 – Sep 20',
      'Lou & Lou',
      'dark',
    )

    expect(svg).toContain('Rock &amp; Roll')
    expect(svg).toContain('Lou &amp; Lou')
    expect(svg).toContain('A &lt; B')
  })
})

describe('<WeekSessionImage />', () => {
  it('falls back to the SVG file when the canvas is unavailable', async () => {
    // jsdom has no real canvas, so the PNG step fails and the UI must still
    // offer something the user can save.
    render(
      <WeekSessionImage
        sessions={sessions}
        weekTitle="Sep 14 – Sep 20"
        displayName="Luis"
        userId="user-1"
        theme="light"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share Week' }))

    expect(await screen.findByRole('button', { name: 'Save SVG' })).toBeTruthy()
  })

  it('renders nothing when the user has no sessions in the week', () => {
    const { container } = render(
      <WeekSessionImage
        sessions={[entry({ user_id: 'someone-else' })]}
        weekTitle="Sep 14 – Sep 20"
        displayName="Luis"
        userId="user-1"
        theme="dark"
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
