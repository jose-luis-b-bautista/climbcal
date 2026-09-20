/**
 * The auth screen is the first thing a new visitor sees, so it needs the theme
 * switch (and the theme switch needs a provider above it).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../hooks/useAuth'
import { THEME_STORAGE_KEY, ThemeProvider } from '../hooks/useTheme'
import Login from './Login'

// No session here, otherwise <Login> redirects to the week view.
vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('../test/supabaseMock')
  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(() => ({ data: null, error: null }), null),
  }
})

function renderLogin() {
  // Same provider nesting as main.tsx.
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('<Login />', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('offers the theme switch before signing in', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    renderLogin()

    expect(await screen.findByRole('heading', { name: 'climbcal' })).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()

    // Seeded dark preference ⇒ the switch offers light mode.
    const toggle = screen.getByRole('button', { name: 'Switch to light mode' })
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(toggle)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeTruthy()
  })
})