/**
 * The share image is generated as a logo-free SVG string, so its palette can be
 * asserted directly: the same sessions must come out on the app's dark tokens
 * when the app is dark, and on the light tokens when it is light.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeekSessionImage, generateWeekSessionSVG, WEEK_IMAGE_HEADLINE } from './WeekSessionImage'
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
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'dark')

    expect(svg).toContain('width="1080"')
    expect(svg).toContain('height="1920"')
    // No full-canvas rect: the background is transparent for overlaying.
    expect(svg).not.toContain('<rect width="1080" height="1920"')
    // Card/accent tokens from the dark theme.
    expect(svg).toContain('fill="#10b981"')
    expect(svg).not.toContain('fill="#fafafa"')
  })

  it('paints the light palette when the app is light', () => {
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'light')

    // Accents go emerald-600 light, and the page stays transparent.
    expect(svg).not.toContain('<rect width="1080" height="1920"')
    expect(svg).toContain('fill="#065f46"')
    expect(svg).not.toContain('fill="#09090b"')
  })

  it('lists each climb with its day, gym and time window', () => {
    const svg = generateWeekSessionSVG(
      [entry(), entry({ id: 'climb-2', climb_date: '2026-09-18', start_time: '07:00:00', end_time: '09:30:00' })],
      'Sep 14 – Sep 20',
      'dark',
    )

    expect(svg).toContain('WED')
    expect(svg).toContain('FRI')
    expect(svg).toContain('Vertical Hub')
    expect(svg).toContain('18:30 – 21:00')
    expect(svg).toContain('07:00 – 09:30')
  })

  it('escapes user text so `&` cannot break the SVG', () => {
    const svg = generateWeekSessionSVG(
      [entry({ gym: { id: 'gym-2', name: 'Rock & Roll' }, note: 'A < B' })],
      'Sep 14 – Sep 20',
      'dark',
    )

    expect(svg).toContain('Rock &amp; Roll')
    expect(svg).toContain('A &lt; B')
  })

  it('handles a second gym on the same day', () => {
    const svg = generateWeekSessionSVG(
      [
        entry(),
        entry({
          id: 'climb-2',
          gym: { id: 'gym-2', name: 'Flow State' },
          start_time: '19:00:00',
          end_time: '21:30:00',
        }),
      ],
      'Sep 14 – Sep 20',
      'dark',
    )

    expect(svg).toContain('Vertical Hub + Flow State')
    expect(svg).toContain('19:00 – 21:30')
    expect(svg).not.toContain('2 sessions')
  })

  it('uses the gym primary colour for the accent stripe', () => {
    const svg = generateWeekSessionSVG(
      [entry({ gym: { id: 'gym-1', name: 'Boulder24' } })],
      'Sep 14 – Sep 20',
      'dark',
    )

    expect(svg).toContain('fill="#EF4444"')
  })

  it('omits per-day summaries, rest days and the week total', () => {
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'dark')

    expect(svg).not.toContain('WEEK OF')
    expect(svg).not.toContain('1 session')
    expect(svg).not.toContain('REST DAYS')
    // No duration summaries remain anywhere.
    expect(svg).not.toContain('2h 30m')
  })

  it('keeps the header and footer inside the Instagram Stories safe zones', () => {
    const svg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'dark')

    // Instagram covers roughly the top and bottom 250px of a 1080x1920 story.
    // The date eyebrow starts at 250 + 42 and the headline at 250 + 116.
    expect(svg).toContain('y="292"')
    expect(svg).toContain('y="366"')
    // The headline replaces the date range as the big title; the range is the
    // small eyebrow above it.
    expect(svg).toContain(WEEK_IMAGE_HEADLINE)
    expect(svg).toContain('Sep 14 – Sep 20')
    // With one card the wordmark anchors 56px below it: 420 + 160 + 56 = 636.
    expect(svg).toContain('y="636"')
    expect(svg).toContain('🧗 climbcal.app')
    // The footer divider was removed entirely.
    expect(svg).not.toContain('<line')
  })

  it('leaves a fixed gap between the header and the first day card', () => {
    // A busy week forces the content to scale, so the group starts exactly at
    // the content offset: 420.
    const busyWeek = Array.from({ length: 7 }, (_, day) =>
      entry({
        id: `busy-${day}`,
        climb_date: `2026-09-${String(14 + day).padStart(2, '0')}`,
      }),
    )
    const svg = generateWeekSessionSVG(busyWeek, 'Sep 14 – Sep 20', 'dark')

    expect(svg).toContain(' 420) scale(')

    // Even a single climb is anchored below the header instead of being
    // centred halfway down the canvas.
    const lightSvg = generateWeekSessionSVG(sessions, 'Sep 14 – Sep 20', 'dark')
    expect(lightSvg).toContain('translate(0 420) scale(1)')
  })

  it('keeps the note just under the time line', () => {
    // One day, one time line, one note: the card is 184 tall (420..604) and the
    // note sits NOTE_GAP (32px) under the 548 baseline - not stranded at a
    // fixed card bottom.
    const svg = generateWeekSessionSVG(
      [entry({ note: 'Bring the rope' })],
      'Sep 14 – Sep 20',
      'dark',
    )

    const time = svg.match(/y="(\d+)"[^>]*>18:30 – 21:00</)
    const note = svg.match(/y="(\d+)"[^>]*>Bring the rope</)

    expect(time).toBeTruthy()
    expect(note).toBeTruthy()
    expect(Number(note?.[1]) - Number(time?.[1])).toBe(32)
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
        userId="user-1"
        theme="dark"
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
