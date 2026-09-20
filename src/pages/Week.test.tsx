/**
 * Integration render of the week view with the Supabase client mocked out:
 * proves the auth gate, friend lookup, climb query and gym join all wire up and
 * render the expected cards.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
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
})
