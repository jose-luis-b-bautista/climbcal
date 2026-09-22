/**
 * Public feed coverage: public climbers *and* your own sessions (even when your
 * profile is private), no visibility badge, and the @handle beside the name.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

// Hoisted with the log: the `vi.mock` factory runs before module-level consts.
const { TODAY } = vi.hoisted(() => ({ TODAY: '2026-09-20' }))

vi.mock('../lib/supabase', async () => {
  const { TEST_USER_ID, createSupabaseMock } = await import('../test/supabaseMock')
  const stamp = '2026-09-01T00:00:00.000Z'
  const maraId = '22222222-2222-2222-2222-222222222222'
  const noorId = '33333333-3333-3333-3333-333333333333'
  const samId = '44444444-4444-4444-4444-444444444444'

  const me = {
    id: TEST_USER_ID,
    username: 'luis',
    display_name: 'Luis',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const mara = {
    id: maraId,
    username: 'mara',
    display_name: 'Mara',
    visibility: 'public',
    created_at: stamp,
    updated_at: stamp,
  }
  // Public, but with no display name: the handle has to stand on its own.
  const noor = {
    id: noorId,
    username: 'noor',
    display_name: null,
    visibility: 'public',
    created_at: stamp,
    updated_at: stamp,
  }
  // Private and not me: their session must stay out of the feed.
  const sam = {
    id: samId,
    username: 'sam',
    display_name: 'Sam',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }

  const session = (id: string, userId: string, custom_gym_name: string) => ({
    id,
    user_id: userId,
    climb_date: TODAY,
    start_time: '18:00:00',
    end_time: '20:00:00',
    start_slot: null,
    end_slot: null,
    gym_id: null,
    custom_gym_name,
    gym_id_2: null,
    custom_gym_name_2: null,
    note: null,
    created_at: stamp,
    updated_at: stamp,
    gym: null,
    gym_2: null,
  })

  const climbs = [
    session('mine', TEST_USER_ID, 'Boulder Space'),
    session('mara', maraId, 'BHive'),
    session('noor', noorId, 'Boulder World'),
    session('sam', samId, 'Summit Loft'),
  ]
  const profiles = [me, mara, noor, sam]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters }) => {
      if (table === 'climbs') {
        const from = filters['gte.climb_date']
        const to = filters['lte.climb_date']
        return {
          data: climbs.filter(
            (row) =>
              (typeof from !== 'string' || row.climb_date >= from) &&
              (typeof to !== 'string' || row.climb_date <= to),
          ),
          error: null,
        }
      }
      if (table === 'profiles') {
        const single = filters.id
        if (typeof single === 'string') {
          return { data: profiles.find((profile) => profile.id === single) ?? null, error: null }
        }
        const ids = filters['in.id']
        if (Array.isArray(ids)) {
          return { data: profiles.filter((profile) => ids.includes(profile.id)), error: null }
        }
        return { data: profiles, error: null }
      }
      if (table === 'friendships') return { data: [], error: null }
      return { data: null, error: null }
    }),
  }
})

function renderFeed() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/feed']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('<Feed />', () => {
  beforeEach(() => {
    // Pinned so "today" and the 20-day horizon are deterministic.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-20T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows your own sessions next to public ones, and no visibility badge', async () => {
    renderFeed()

    // Mine (private profile) and a public climber's session…
    expect(await screen.findByText('Boulder Space')).toBeTruthy()
    expect(screen.getByText('BHive')).toBeTruthy()

    // …but not another climber's private session.
    expect(screen.queryByText('Summit Loft')).toBeNull()

    // The badge is gone, and the private-profile note now says sessions *are*
    // visible to you, rather than that they are missing.
    expect(screen.queryByText('Public')).toBeNull()
    expect(screen.getByText(/only you can see your sessions here/)).toBeTruthy()
  })

  it('shows the @handle beside the display name, and alone when there is none', async () => {
    renderFeed()

    expect(await screen.findByText('Mara')).toBeTruthy()
    expect(screen.getByText('@mara')).toBeTruthy()

    // Noor has no display name, so the handle is the name — printed once.
    expect(screen.getByText('@noor')).toBeTruthy()
    expect(screen.queryByText('noor')).toBeNull()

    // The app header prints the signed-in handle too, so Luis/@luis both appear.
    expect(screen.getAllByText('Luis').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('@luis').length).toBeGreaterThanOrEqual(1)
  })
})