/**
 * Integration render of the calendar page with the Supabase client mocked out:
 * proves the auth gate, friend lookup, climb queries and gym join all wire up,
 * render the expected cards, and that today, tomorrow and the week share a page.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

vi.mock('../lib/supabase', async () => {
  const { createClimbcalSupabaseMock } = await import('../test/fixture')
  return {
    isSupabaseConfigured: true,
    supabase: createClimbcalSupabaseMock(),
  }
})

beforeAll(() => {
  // The week view is rendered for a fixed Monday so assertions are stable.
  window.history.replaceState({}, '', '/')
})

describe('<Week />', () => {
  beforeEach(() => {
    // Pinned so "today" is deterministic: the fixture's sessions are on
    // Wednesday 2026-09-16 — inside the week being browsed, but not today.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-20T19:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows own and friend sessions for the selected week', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/week?week=2026-09-14']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // Friend's session card (gym stored as free text).
    expect(await screen.findByText('Mara')).toBeTruthy()
    expect(screen.getByText('Boulder Barn')).toBeTruthy()

    // A one-off name has no brand palette, so it gets the neutral cell.
    expect(screen.getByText('Boulder Barn').className).toContain('border-zinc-700')

    // Own session card, highlighted with "(you)".
    const ownLabel = screen.getByText(/\(you\)/)
    expect(ownLabel.parentElement?.textContent).toContain('Luis')
    expect(screen.getByText('Vertical Hub')).toBeTruthy()

    // Time windows and durations for both windows.
    expect(screen.getByText(/18:30 – 21:00/)).toBeTruthy()
    expect(screen.getByText(/07:00 – 09:00/)).toBeTruthy()

    // Day-level friend count: Wednesday has one friend climbing.
    expect(screen.getAllByText(/1 friend climbing/).length).toBeGreaterThan(0)

    // Week header for the requested week (appears in the range hint and the
    // Monday column), so at least one match is expected.
    expect(screen.getAllByText(/Sep 14/).length).toBeGreaterThan(0)

    // The empty-week placeholder must not be shown.
    expect(screen.queryByText('Bone dry week')).toBeNull()

    // Signed-in navigation, not the login screen.
    expect(screen.getByRole('link', { name: 'Feed' })).toBeTruthy()

    // The theme switch is available in the app shell.
    expect(screen.getByRole('button', { name: /switch to .* mode/i })).toBeTruthy()
  })

  it('stacks today and tomorrow above the week grid, without tabs', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/week?week=2026-09-14']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // All three sections on one page.
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Week' })).toBeTruthy()

    // The fixture has nothing on the pinned today / tomorrow, so those cards say
    // so instead of borrowing Wednesday's sessions.
    expect(await screen.findByText('Nothing on today')).toBeTruthy()
    expect(screen.getByText('Nothing on tomorrow')).toBeTruthy()

    // Mon–Sun grid below: six empty columns plus Wednesday's two sessions.
    expect(screen.getAllByText('Nothing planned')).toHaveLength(6)

    // The muted asides (per-day counts, empty-card hints) are desktop-only, so
    // they keep `hidden sm:block`; the tests run without CSS, hence the classes.
    expect(screen.getAllByText('No friends yet')[0].className).toContain('sm:block')
    expect(screen.getAllByText('No friends yet')[0].className).toContain('hidden')
    expect(
      screen.getAllByText('Post a session and your friends will see it here.')[0].className,
    ).toContain('hidden')

    // And no view switcher to switch between them.
    expect(screen.queryByRole('group', { name: 'Calendar view' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Week' })).toBeNull()
  })
})
