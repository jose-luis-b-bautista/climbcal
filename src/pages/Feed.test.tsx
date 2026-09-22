/**
 * Public feed coverage: public climbers *and* your own sessions (even when your
 * profile is private), no visibility badge, and the @handle beside the name.
 */
import { fireEvent, render, screen } from '@testing-library/react'
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

  const session = (
    id: string,
    userId: string,
    custom_gym_name: string,
    custom_gym_name_2: string | null = null,
  ) => ({
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
    custom_gym_name_2,
    note: null,
    created_at: stamp,
    updated_at: stamp,
    gym: null,
    gym_2: null,
  })

  const climbs = [
    session('mine', TEST_USER_ID, 'Boulder Space'),
    session('mara', maraId, 'BHive'),
    // An "either" session: the filter has to match both of its gyms.
    session('mara-either', maraId, 'Boulder World', 'BHive'),
    session('noor', noorId, 'Boulder World'),
    session('sam', samId, 'Summit Loft'),
  ]
  const profiles = [me, mara, noor, sam]

  const gym = (id: string, name: string) => ({
    id,
    name,
    region: 'Luzon',
    city: null,
    created_by: null,
    created_at: stamp,
  })
  // 'BHive' has sessions in the feed, 'Edge Climb' has none — both are options.
  const gyms = [
    gym('gym-space', 'Boulder Space'),
    gym('gym-hive', 'BHive'),
    gym('gym-world', 'Boulder World'),
    gym('gym-edge', 'Edge Climb'),
  ]

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
      if (table === 'gyms') return { data: gyms, error: null }
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

    // Mine (private profile) and a public climber's session. `selector: 'span'`
    // picks the gym cell rather than the gym filter's <option> of the same name.
    expect(await screen.findByText('Boulder Space', { selector: 'span' })).toBeTruthy()
    const hiveCell = screen.getByText('BHive', { selector: 'span' })
    // The cell takes the gym's primary as its fill, its background as the ink.
    expect(hiveCell.getAttribute('style')).toContain('rgb(250, 208, 44)')
    expect(hiveCell.getAttribute('style')).toContain('rgb(22, 46, 90)')

    // …but not another climber's private session.
    expect(screen.queryByText('Summit Loft', { selector: 'span' })).toBeNull()

    // …and the badge is gone, and the private-profile note now says sessions *are*
    // visible to you, rather than that they are missing.
    expect(screen.queryByText('Public')).toBeNull()
    expect(screen.getByText(/only you can see your sessions here/)).toBeTruthy()

    // Avatar chips are per climber, not the same green for everyone.
    const mine = screen.getAllByText('LU')[0]
    const mara = screen.getAllByText('MA')[0]
    expect(mara.className).toContain('bg-avatar-')
    expect(mara.className).not.toBe(mine.className)
  })

  it('shows the @handle beside the display name, and alone when there is none', async () => {
    renderFeed()

    // Mara has two sessions in the fixture, so counts are "at least one".
    expect((await screen.findAllByText('Mara')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('@mara').length).toBeGreaterThan(0)

    // Noor has no display name, so the handle is the name — printed once.
    expect(screen.getByText('@noor')).toBeTruthy()
    expect(screen.queryByText('noor')).toBeNull()

    // The app header prints the signed-in handle too, so Luis/@luis both appear.
    expect(screen.getAllByText('Luis').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('@luis').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by gym, defaulting to every gym', async () => {
    renderFeed()

    const filter = (await screen.findByLabelText('Filter by gym')) as HTMLSelectElement
    expect(filter.value).toBe('')

    // Default: all of them.
    expect(await screen.findByText('Boulder Space', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText('BHive', { selector: 'span' })).toBeTruthy()

    // A gym that does have sessions…
    fireEvent.change(filter, { target: { value: 'gym-hive' } })
    expect(screen.getByText('BHive', { selector: 'span' })).toBeTruthy()
    expect(screen.queryByText('Boulder Space', { selector: 'span' })).toBeNull()
    expect(screen.queryByText('Boulder World', { selector: 'span' })).toBeNull()

    // …and one that does not, which says so instead of looking broken.
    fireEvent.change(filter, { target: { value: 'gym-edge' } })
    expect(screen.getByText('Nobody at Edge Climb')).toBeTruthy()

    // Back to everything.
    fireEvent.change(filter, { target: { value: '' } })
    expect(screen.getByText('Boulder Space', { selector: 'span' })).toBeTruthy()
  })

  it('matches an "either" session on both of its gyms', async () => {
    renderFeed()

    const filter = (await screen.findByLabelText('Filter by gym')) as HTMLSelectElement
    // Wait for the feed's data before poking the filter, or the cards below may
    // not have rendered yet.
    await screen.findByText('Either Boulder World or BHive', { selector: 'span' })
    const either = () => screen.getByText('Either Boulder World or BHive', { selector: 'span' })

    fireEvent.change(filter, { target: { value: 'gym-hive' } })
    expect(either()).toBeTruthy()

    fireEvent.change(filter, { target: { value: 'gym-world' } })
    expect(either()).toBeTruthy()
  })
})