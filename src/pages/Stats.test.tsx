/**
 * Stats tab coverage: the headline numbers, the heatmap (levels *and* the dashed
 * planned days), the gym breakdown's order and colours, switching to a friend,
 * the linkable `?climber=` param, and the hint shown when the views are not
 * deployed yet.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

// Hoisted with the fixture: `vi.mock` factories run before module-level consts.
const { TEST_USER_ID, FRIEND_ID, state } = vi.hoisted(() => ({
  TEST_USER_ID: '11111111-1111-1111-1111-111111111111',
  FRIEND_ID: '22222222-2222-2222-2222-222222222222',
  /** Flipped by the missing-views test: the stats views are not deployed. */
  state: { missingViews: false },
}))

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('../test/supabaseMock')
  const stamp = '2026-09-01T00:00:00.000Z'

  const me = {
    id: TEST_USER_ID,
    username: 'luis',
    display_name: 'Luis',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const mara = {
    id: FRIEND_ID,
    username: 'mara',
    display_name: 'Mara',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const friendship = {
    id: '44444444-4444-4444-4444-444444444444',
    requester_id: FRIEND_ID,
    addressee_id: TEST_USER_ID,
    status: 'accepted',
    created_at: stamp,
    updated_at: stamp,
  }

  const totals = [
    {
      user_id: TEST_USER_ID,
      sessions: 8,
      sessions_past: 6,
      sessions_upcoming: 2,
      active_days: 4,
      active_weeks: 3,
      active_months: 2,
      first_session: '2026-08-05',
      last_session: '2026-09-16',
      exact_minutes: 270,
      avg_exact_minutes: 90,
      exact_minutes_upcoming: 60,
      sessions_with_note: 1,
      gyms_visited: 2,
      regions_visited: 1,
    },
    {
      user_id: FRIEND_ID,
      sessions: 3,
      sessions_past: 3,
      sessions_upcoming: 0,
      active_days: 2,
      active_weeks: 2,
      active_months: 1,
      first_session: '2026-09-02',
      last_session: '2026-09-09',
      exact_minutes: 120,
      avg_exact_minutes: 60,
      exact_minutes_upcoming: 0,
      sessions_with_note: 0,
      gyms_visited: 1,
      regions_visited: 1,
    },
  ]

  const activity = [
    // A two-session day, a long one, a short one, and a plan for Saturday.
    { climb_date: '2026-09-16', week_start: '2026-09-14', iso_dow: 3, sessions: 2, exact_sessions: 2, duration_minutes: 180, exact_minutes: 60, notes: 1 },
    { climb_date: '2026-09-09', week_start: '2026-09-07', iso_dow: 3, sessions: 1, exact_sessions: 1, duration_minutes: 120, exact_minutes: 120, notes: 0 },
    { climb_date: '2026-08-05', week_start: '2026-08-03', iso_dow: 3, sessions: 1, exact_sessions: 1, duration_minutes: 90, exact_minutes: 90, notes: 0 },
    { climb_date: '2026-09-19', week_start: '2026-09-14', iso_dow: 6, sessions: 1, exact_sessions: 1, duration_minutes: 60, exact_minutes: 60, notes: 0 },
  ].map((row) => ({ ...row, user_id: TEST_USER_ID }))

  const gymStats = [
    // Out of order, and the unnamed bucket is the biggest one: ranking still puts
    // the named gyms first, while the bars scale against the biggest row overall.
    { user_id: TEST_USER_ID, gym_name: 'Not sure yet', region: 'Other', is_named_gym: false, sessions: 4, days: 3, first_visit: '2026-08-05', last_visit: '2026-09-19', duration_minutes: 300, exact_minutes: 60 },
    { user_id: TEST_USER_ID, gym_name: 'Boulder Space', region: 'Luzon', is_named_gym: true, sessions: 2, days: 1, first_visit: '2026-09-09', last_visit: '2026-09-09', duration_minutes: 120, exact_minutes: 120 },
    { user_id: TEST_USER_ID, gym_name: 'BHive', region: 'Luzon', is_named_gym: true, sessions: 3, days: 2, first_visit: '2026-08-05', last_visit: '2026-09-16', duration_minutes: 240, exact_minutes: 90 },
    // Mara climbs at one gym, and never leaves a session unnamed.
    { user_id: FRIEND_ID, gym_name: 'Boulder Space', region: 'Luzon', is_named_gym: true, sessions: 3, days: 2, first_visit: '2026-09-02', last_visit: '2026-09-09', duration_minutes: 120, exact_minutes: 120 },
  ]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters }) => {
      // Only the stats views are missing: auth and friends still answer, so the
      // page renders its hint instead of bouncing back to onboarding.
      if (state.missingViews && table.startsWith('climber')) {
        return {
          data: null,
          error: { message: `relation "public.${table}" does not exist`, code: '42P01' },
        }
      }

      switch (table) {
        case 'climber_totals':
          return {
            data: totals.find((row) => row.user_id === filters.user_id) ?? null,
            error: null,
          }
        case 'climber_daily_activity': {
          const since = filters['gte.climb_date']
          return {
            data: activity.filter(
              (row) =>
                row.user_id === filters.user_id &&
                (typeof since !== 'string' || row.climb_date >= since),
            ),
            error: null,
          }
        }
        case 'climber_gym_stats':
          return { data: gymStats.filter((row) => row.user_id === filters.user_id), error: null }
        case 'profiles': {
          const single = filters.id
          if (typeof single === 'string') {
            return {
              data: [me, mara].find((profile) => profile.id === single) ?? null,
              error: null,
            }
          }
          const ids = filters['in.id']
          if (Array.isArray(ids)) {
            return { data: [me, mara].filter((profile) => ids.includes(profile.id)), error: null }
          }
          return { data: [me, mara], error: null }
        }
        case 'friendships':
          return { data: [friendship], error: null }
        default:
          return { data: null, error: null }
      }
    }),
  }
})

function renderStats(entry = '/stats') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

/** The value + hint text of a headline card, found by its label. */
function statCard(label: string): string {
  return screen.getByText(label).parentElement?.textContent ?? ''
}

describe('<Stats />', () => {
  beforeEach(() => {
    state.missingViews = false
    // Pinned midweek, so the 26-week window, "today" and the planned days are
    // all fixed (a Sunday pin would leave nothing ahead in the current column).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is reachable from the nav and shows the headline numbers', async () => {
    renderStats()

    // A real tab, not a hidden route.
    expect(await screen.findByRole('link', { name: 'Stats' })).toBeTruthy()
    expect(
      await screen.findByText('Your climbing so far — every session you have posted.'),
    ).toBeTruthy()
    // The cards only exist once the totals row has landed.
    await screen.findByText('On the wall')

    expect(statCard('Sessions')).toContain('6')
    expect(statCard('Sessions')).toContain('+2 planned')
    expect(statCard('Active days')).toContain('4')
    expect(statCard('Active days')).toContain('over 3 weeks')
    // 270 exact minutes, and 90 average — never the notional slot windows.
    expect(statCard('On the wall')).toContain('4h 30m')
    expect(statCard('Usual session')).toContain('1h 30m')
    expect(statCard('Gyms')).toContain('2')
    expect(statCard('Gyms')).toContain('1 region')
    expect(statCard('Notes written')).toContain('1')

    // The range footer (dates are rendered without a year, like the feed's cards).
    const footer = screen.getByText(/First session/).textContent ?? ''
    expect(footer).toContain('Aug 5')
    expect(footer).toContain('Sep 16')
  })

  it('shades a day when you climbed, and dashes the days still to come', async () => {
    renderStats()
    await screen.findByText('Where I climb')

    // 26 Monday-first weeks × 7 days.
    expect(document.querySelectorAll('[role="img"]').length).toBe(182)

    // Shaded or not, with nothing in between: a two-session day and a one-session
    // day look identical, because the grid answers "did I climb that day?".
    const busy = screen.getByLabelText(/Sep 16: 2 sessions, 1h$/)
    const single = screen.getByLabelText(/Sep 9: 1 session, 2h$/)
    expect(busy.className).toContain('bg-emerald-700')
    expect(single.className).toBe(busy.className)

    // …while a day with nothing is the empty shade.
    expect(screen.getByLabelText(/Sep 15: no sessions$/).className).toContain('bg-zinc-800/70')

    // Friday and Saturday are still to come, so they read as plans, not levels.
    const planned = screen.getByLabelText(/Sep 19: 1 session, 1h \(planned\)$/)
    expect(planned.className).toContain('border-dashed')
    expect(planned.className).not.toContain('bg-emerald-')

    // …and so does an empty future day, honestly labelled.
    expect(screen.getByLabelText(/Sep 17: no sessions \(planned\)$/).className).toContain(
      'border-dashed',
    )

    // Today's own cell is not marked planned.
    expect(busy.className).not.toContain('border-dashed')
  })

  it('ranks gyms by sessions, keeps the unnamed bucket last, and uses the palette', async () => {
    renderStats()

    const list = await screen.findByRole('list', { name: 'Where I climb' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)

    expect(rows[0].textContent).toContain('BHive')
    expect(rows[0].textContent).toContain('3 sessions · 2 days · 1h 30m')
    expect(rows[1].textContent).toContain('Boulder Space')
    // The biggest row of all, but not a gym: it stays at the bottom.
    expect(rows[2].textContent).toContain('Not sure yet')
    expect(rows[2].textContent).toContain('4 sessions')

    // The gym's own colours, verbatim: primary fills, background inks.
    const hive = within(list).getByText('BHive')
    expect(hive.getAttribute('style')).toContain('rgb(49, 116, 180)')
    expect(hive.getAttribute('style')).toContain('rgb(251, 252, 247)')

    // Bars scale against the biggest row (4), not against the first named gym.
    const bars = rows.map((row) => row.querySelector('div[style]') as HTMLElement)
    expect([bars[0].style.width, bars[1].style.width, bars[2].style.width]).toEqual([
      '75%',
      '50%',
      '100%',
    ])
  })

  it('switches to a friend from the climber picker', async () => {
    renderStats()

    const picker = (await screen.findByLabelText('Climber')) as HTMLSelectElement
    // The friend list arrives on its own query, so wait for her option to land.
    await screen.findByRole('option', { name: 'Mara (@mara)' })
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      'You (@luis)',
      'Mara (@mara)',
    ])

    fireEvent.change(picker, { target: { value: FRIEND_ID } })

    expect(await screen.findByText('The sessions Mara has posted that you can see.')).toBeTruthy()
    // Hers only: your own numbers never sit under her name while she loads.
    expect(await screen.findByText(/posted and done/)).toBeTruthy()
    expect(screen.queryByText('+2 planned')).toBeNull()
    expect(statCard('Sessions')).toContain('3')

    // Her breakdown is one gym, with no unnamed bucket.
    const list = screen.getByRole('list', { name: 'Where I climb' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  })

  it('opens on a friend from ?climber=', async () => {
    renderStats(`/stats?climber=${FRIEND_ID}`)

    expect(await screen.findByText('The sessions Mara has posted that you can see.')).toBeTruthy()
    expect(await screen.findByText(/posted and done/)).toBeTruthy()
    expect(statCard('Sessions')).toContain('3')
  })

  it('falls back to your own stats for an unknown ?climber= id', async () => {
    renderStats('/stats?climber=99999999-9999-9999-9999-999999999999')

    expect(
      await screen.findByText('Your climbing so far — every session you have posted.'),
    ).toBeTruthy()
    const picker = (await screen.findByLabelText('Climber')) as HTMLSelectElement
    expect(picker.value).toBe(TEST_USER_ID)
  })

  it('points at the migration instead of leaking the PostgREST error', async () => {
    state.missingViews = true
    renderStats()

    expect(await screen.findByText(/The stats views are not in the database yet/)).toBeTruthy()
    expect(screen.getByText(/20260923000000_stats_views\.sql/)).toBeTruthy()
    expect(screen.queryByText(/does not exist/)).toBeNull()
  })
})
