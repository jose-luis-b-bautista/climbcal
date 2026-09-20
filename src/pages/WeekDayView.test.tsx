/**
 * Integration coverage for the calendar page: the Today and Tomorrow cards sit
 * on top of the week grid, on one page and with no tab switcher.
 *
 * The clock is pinned, so "today" is deterministic, and the fixture is built
 * around that pinned day: a session spanning the whole day, a slot-based one,
 * a finished one, one starting in an hour, and one tomorrow.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import type { MockQueryContext } from '../test/supabaseMock'

// Hoisted with the log: the `vi.mock` factory below runs before module-level
// consts are initialised, so the dates have to live in here too.
const { queryLog, TODAY, TOMORROW } = vi.hoisted(() => ({
  queryLog: [] as MockQueryContext[],
  TODAY: '2026-09-20',
  TOMORROW: '2026-09-21',
}))

vi.mock('../lib/supabase', async () => {
  const { TEST_USER_ID, createSupabaseMock } = await import('../test/supabaseMock')
  const stamp = '2026-09-01T00:00:00.000Z'
  const friendId = '22222222-2222-2222-2222-222222222222'
  const gymId = '33333333-3333-3333-3333-333333333333'

  const me = {
    id: TEST_USER_ID,
    username: 'luis',
    display_name: 'Luis',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const friend = {
    id: friendId,
    username: 'mara',
    display_name: 'Mara',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const gym = {
    id: gymId,
    name: 'Vertical Hub',
    region: null,
    city: null,
    created_by: null,
    created_at: stamp,
  }

  const session = (
    id: string,
    userId: string,
    climb_date: string,
    custom_gym_name: string,
    window: Record<string, string | null>,
  ) => ({
    id,
    user_id: userId,
    climb_date,
    gym_id: null,
    custom_gym_name,
    note: null,
    created_at: stamp,
    updated_at: stamp,
    gym: null,
    ...window,
  })

  const clock = (start: string, end: string) => ({
    start_time: start,
    end_time: end,
    start_slot: null,
    end_slot: null,
  })
  const slots = (start: string, end: string) => ({
    start_time: null,
    end_time: null,
    start_slot: start,
    end_slot: end,
  })

  const climbs = [
    // Mine, "on now" at the pinned 19:00; linked to a real gym row.
    {
      ...session('c1', TEST_USER_ID, TODAY, '', clock('00:00:00', '23:59:00')),
      gym_id: gymId,
      gym: { id: gymId, name: 'Vertical Hub' },
    },
    session('c2', friendId, TODAY, 'Boulder Barn', slots('Opening', 'Closing')),
    session('c3', friendId, TODAY, 'Summit Loft', clock('07:00:00', '09:00:00')),
    session('c4', friendId, TODAY, 'The Crux', clock('20:00:00', '22:00:00')),
    session('c5', friendId, TOMORROW, 'Riverside Boulders', clock('18:00:00', '20:00:00')),
  ]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock((context) => {
      queryLog.push(context)
      const { table, filters } = context

      if (table === 'profiles') {
        const single = filters.id
        if (typeof single === 'string') {
          return { data: [me, friend].find((row) => row.id === single) ?? null, error: null }
        }
        const ids = filters['in.id']
        if (Array.isArray(ids)) {
          return { data: [me, friend].filter((row) => ids.includes(row.id)), error: null }
        }
        return { data: [me, friend], error: null }
      }

      if (table === 'friendships') {
        return {
          data: [
            {
              id: '44444444-4444-4444-4444-444444444444',
              requester_id: friendId,
              addressee_id: TEST_USER_ID,
              status: 'accepted',
              created_at: stamp,
              updated_at: stamp,
            },
          ],
          error: null,
        }
      }

      if (table === 'gyms') return { data: [gym], error: null }

      if (table === 'climbs') {
        const from = filters['gte.climb_date']
        const to = filters['lte.climb_date']
        const ids = filters['in.user_id']
        return {
          data: climbs.filter(
            (row) =>
              (typeof from !== 'string' || row.climb_date >= from) &&
              (typeof to !== 'string' || row.climb_date <= to) &&
              (!Array.isArray(ids) || ids.includes(row.user_id)),
          ),
          error: null,
        }
      }

      return { data: null, error: null }
    }),
  }
})

function renderApp(path: string) {
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

/** Every date range the page has queried for climbs, in order. */
function climbRanges() {
  return queryLog
    .filter((entry) => entry.table === 'climbs')
    .map((entry) => `${entry.filters['gte.climb_date']}..${entry.filters['lte.climb_date']}`)
}

describe('<Week /> day views', () => {
  beforeEach(() => {
    queryLog.length = 0
    // 2026-09-20 is a Sunday; 19:00 makes every timing assertion deterministic.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-20T19:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on today and tomorrow above the week, with no tab switcher', async () => {
    renderApp('/week')

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Week' })).toBeTruthy()

    // Today's sessions are summarised up top; today is also a column in the grid
    // below, so each name legitimately shows up more than once. The friend's row
    // only appears once the friend lookup has resolved, so wait on that first.
    expect((await screen.findAllByText('Boulder Barn')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Vertical Hub')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Summit Loft').length).toBeGreaterThan(0)
    expect(screen.getAllByText('The Crux').length).toBeGreaterThan(0)

    // Relative badges belong to today only. The day-long session and the
    // "Opening – Closing" slot session are both live (slots sit on the same
    // canonical scale the app orders by), the 07:00 one is done, and the 20:00
    // one starts in an hour.
    expect(screen.getAllByText('On now').length).toBe(2)
    expect(screen.getByText('Finished')).toBeTruthy()
    expect(screen.getByText('Starts in 1h')).toBeTruthy()
    expect(screen.getAllByText('Opening – Closing').length).toBeGreaterThan(0)

    // Summary line: sessions, friends, and the day's span.
    expect(screen.getByText(/4 sessions · 1 friend climbing · 00:00 – 22:00/)).toBeTruthy()

    // Tomorrow's card is on the page too — there is no tab to reach it.
    expect(screen.getAllByText('Riverside Boulders').length).toBe(1)

    // The grid covers Mon–Sun with an add button per day, and the view switcher
    // is gone entirely.
    expect(screen.getAllByRole('button', { name: /^Add a session on / })).toHaveLength(7)
    expect(screen.queryByRole('group', { name: 'Calendar view' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tomorrow' })).toBeNull()

    // Two ranges: the day cards always ask for the real today → tomorrow, the
    // grid asks for the week being browsed.
    expect(climbRanges()).toContain(`${TODAY}..${TOMORROW}`)
    expect(climbRanges()).toContain('2026-09-14..2026-09-20')
  })

  it('keeps the day cards on today when the grid is paged to another week', async () => {
    renderApp('/week?week=2026-08-31')

    // The far-away week is empty…
    expect(await screen.findByText('Bone dry week')).toBeTruthy()
    expect(climbRanges()).toContain('2026-08-31..2026-09-06')

    // …while today and tomorrow keep describing the real days. Wait for the
    // friend's row (the day query resolves before the friend lookup does).
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy()
    expect((await screen.findAllByText('Boulder Barn')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getAllByText('On now').length).toBe(2))
    expect(screen.getAllByText('Vertical Hub').length).toBe(1)
    expect(screen.getAllByText('Riverside Boulders').length).toBe(1)
    expect(climbRanges()).toContain(`${TODAY}..${TOMORROW}`)
  })

  it('pages the grid without re-scoping the day cards', async () => {
    renderApp('/week')
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '← Prev' }))
    await waitFor(() => expect(climbRanges()).toContain('2026-09-07..2026-09-13'))

    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    await waitFor(() => expect(climbRanges()).toContain('2026-09-14..2026-09-20'))

    // The day cards were never re-scoped by either move.
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(screen.getAllByText('Vertical Hub').length).toBeGreaterThan(0)
  })
})