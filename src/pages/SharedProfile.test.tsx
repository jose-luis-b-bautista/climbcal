/**
 * The share page is the one surface a visitor with no account can open, so this
 * test covers what that implies: a public climber's week renders without a
 * session, a private/unknown username reads as "not shared", the sign-up link
 * carries the visitor back with `?next=`, and the owner gets a copy-link control.
 *
 * The Supabase client is mocked — including `rpc('shared_profile', …)`, which is
 * the only thing the page reads through.
 */
import type { Session } from '@supabase/supabase-js'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import { TEST_USER_ID, makeTestSession } from '../test/supabaseMock'

const maraProfile = {
  id: '99999999-9999-9999-9999-999999999999',
  username: 'mara',
  display_name: 'Mara',
  visibility: 'public' as const,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
}

const luisProfile = { ...maraProfile, id: TEST_USER_ID, username: 'luis', display_name: 'Luis' }

const sharedPayload = {
  profile: maraProfile,
  week_start: '2026-09-14',
  sessions: [
    {
      id: '88888888-8888-8888-8888-888888888888',
      climb_date: '2026-09-16',
      start_time: '07:00:00',
      end_time: '09:00:00',
      start_slot: null,
      end_slot: null,
      gym_name: 'Boulder Barn',
      gym_name_2: null,
    },
  ],
}

/** Mutable state the mocked client reads, so each test picks its own scenario. */
const state = vi.hoisted(() => ({
  session: null as Session | null,
  payload: null as unknown,
  ownProfile: null as unknown,
}))

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('../test/supabaseMock')
  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(
      ({ table }) =>
        table === 'profiles'
          ? { data: state.ownProfile, error: null }
          : { data: null, error: null },
      () => state.session,
      // Only a username the fake database "knows" answers; anything else is the
      // private/unknown case the SQL returns null for.
      ({ fn, args }) =>
        fn === 'shared_profile' && args.p_username === 'mara'
          ? { data: state.payload, error: null }
          : { data: null, error: null },
    ),
  }
})

function renderSharePage(path = '/u/mara') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('<SharedProfile />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // A Sunday, so "this week" is Mon 2026-09-14 – Sun 2026-09-20 — the week
    // containing the fixture session on the Wednesday.
    vi.setSystemTime(new Date('2026-09-20T19:00:00'))
    state.session = null
    state.payload = sharedPayload
    state.ownProfile = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a public climber’s week for a visitor with no account', async () => {
    renderSharePage()

    expect(await screen.findByRole('heading', { name: 'Mara' })).toBeTruthy()
    expect(screen.getByText('@mara')).toBeTruthy()
    expect(screen.getByText('Boulder Barn')).toBeTruthy()
    expect(screen.getByText(/07:00 – 09:00/)).toBeTruthy()

    // Monday starts the week; six of the seven days are empty.
    expect(screen.getAllByText(/Sep 14/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nothing planned')).toHaveLength(6)

    // The app shell is not mounted: this page lives outside the auth gates.
    expect(screen.queryByRole('link', { name: 'Feed' })).toBeNull()

    // The call to action carries them back here once they have an account.
    const createAccount = screen.getByRole('link', { name: 'Create a free account' })
    expect(createAccount.getAttribute('href')).toBe('/login?next=%2Fu%2Fmara')
    expect(screen.queryByRole('link', { name: 'Go to Friends' })).toBeNull()
  })

  it('treats a private or unknown username as “not shared”', async () => {
    state.payload = null
    renderSharePage('/u/nobody')

    expect(await screen.findByText('This profile isn’t shared')).toBeTruthy()
    // Nothing about a real climber leaks through.
    expect(screen.queryByText('Boulder Barn')).toBeNull()
    expect(screen.queryByText('@mara')).toBeNull()
  })

  it('offers friends, not sign-up, to a signed-in visitor', async () => {
    state.session = makeTestSession()
    state.ownProfile = luisProfile
    renderSharePage()

    expect(await screen.findByRole('heading', { name: 'Mara' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Create a free account' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Go to Friends' })).toBeTruthy()
  })

  it('gives the owner a copy-link control on their own public page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    state.session = makeTestSession()
    state.ownProfile = maraProfile
    renderSharePage()

    expect(await screen.findByText(/You are looking at your public page/)).toBeTruthy()

    const link = screen.getByLabelText('Profile link') as HTMLInputElement
    expect(link.value).toMatch(/\/u\/mara$/)

    // jsdom has no Web Share API, so the button falls back to the clipboard.
    fireEvent.click(screen.getByRole('button', { name: 'Share link' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(link.value)
  })
})

