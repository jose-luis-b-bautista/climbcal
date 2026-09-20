/**
 * Integration coverage for the Today / Tomorrow tabs on the week page.
 *
 * The clock is pinned, so "today" is deterministic, and the fixture is built
 * around that pinned day: a session spanning the whole day, a slot-based one,
 * a finished one, one starting in an hour, and one tomorrow.
 */
import { fireEvent, render, screen } from '@testing-library/react'
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

/** The date range of the most recent climbs query. */
function lastClimbRange() {
  const query = queryLog.filter((entry) => entry.table === 'climbs').at(-1)
  return {
    from: query?.filters['gte.climb_date'],
    to: query?.filters['lte.climb_date'],
  }
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

  it('shows only today, with live timing badges', async () => {
    renderApp('/week?view=today')

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy()

    // Wait for the data to land before the synchronous assertions below.
    expect(await screen.findByText('Vertical Hub')).toBeTruthy()
    expect(screen.getByText('Boulder Barn')).toBeTruthy()
    expect(screen.getByText('Summit Loft')).toBeTruthy()
    expect(screen.getByText('The Crux')).toBeTruthy()

    // Tomorrow's session belongs to the other tab.
    expect(screen.queryByText('Riverside Boulders')).toBeNull()

    // The day-long session and the Opening–Closing slot session are live.
    expect(screen.getAllByText('On now').length).toBe(2)
    expect(screen.getByText('Finished')).toBeTruthy()
    expect(screen.getByText('Starts in 1h')).toBeTruthy()

    // Summary line: sessions, friends, and the day's span.
    expect(screen.getByText(/4 sessions · 1 friend climbing · 00:00 – 22:00/)).toBeTruthy()

    // One day only — not the surrounding week.
    expect(lastClimbRange()).toEqual({ from: TODAY, to: TODAY })
  })

  it('shows only tomorrow, without timing badges', async () => {
    renderApp('/week?view=tomorrow')

    expect(await screen.findByRole('heading', { name: 'Tomorrow' })).toBeTruthy()
    expect(await screen.findByText('Riverside Boulders')).toBeTruthy()

    expect(screen.queryByText('Vertical Hub')).toBeNull()
    expect(screen.queryByText('Boulder Barn')).toBeNull()
    expect(screen.queryAllByText('On now').length).toBe(0)

    expect(lastClimbRange()).toEqual({ from: TOMORROW, to: TOMORROW })
  })

  it('returns to the Mon–Sun grid from the Week tab', async () => {
    renderApp('/week?view=today')
    await screen.findByRole('heading', { name: 'Today' })

    fireEvent.click(screen.getByRole('button', { name: 'Week' }))

    // Seven day columns, each with its own add button.
    expect(await screen.findAllByRole('button', { name: /^Add a session on / })).toHaveLength(7)
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull()

    // Today is a Sunday, so this Mon–Sun range holds today's sessions; tomorrow
    // is Monday of the *next* week and must not leak in.
    expect(await screen.findByText('Vertical Hub')).toBeTruthy()
    expect(screen.queryByText('Riverside Boulders')).toBeNull()
    expect(lastClimbRange()).toEqual({ from: '2026-09-14', to: '2026-09-20' })
  })
})