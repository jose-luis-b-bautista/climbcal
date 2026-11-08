/**
 * The hidden /admin route: the password gate, the numbers, and gym management.
 *
 * Note what these tests do *not* prove: that the password protects anything. It
 * ships in the bundle, and the real gate is `profiles.is_admin` + RLS (verified
 * against Postgres in the migration notes).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

// Hoisted with the stamp: the `vi.mock` factory runs before module-level consts
// are initialised, so anything it reads at that point has to live in here.
const { gymRows, gymFailure, stamp } = vi.hoisted(() => ({
  gymRows: [] as Array<Record<string, unknown>>,
  // Set by a test to make the next gym write fail, e.g. an RLS refusal (42501).
  gymFailure: { value: null as { message: string; code?: string } | null },
  stamp: '2026-09-01T00:00:00.000Z',
}))

vi.mock('../lib/supabase', async () => {
  const { TEST_USER_ID, createSupabaseMock } = await import('../test/supabaseMock')

  const me = {
    id: TEST_USER_ID,
    username: 'luis',
    display_name: 'Luis',
    visibility: 'public',
    created_at: stamp,
    updated_at: stamp,
  }
  const mara = {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'mara',
    display_name: 'Mara',
    visibility: 'public',
    created_at: stamp,
    updated_at: stamp,
  }
  // Private profile: its climbs stay out of the feed, but the dashboard lists
  // them (that is the `climbs_select_admin` policy, not a client-side filter).
  const noe = {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'noe',
    display_name: 'Noe',
    visibility: 'private',
    created_at: stamp,
    updated_at: stamp,
  }
  const profiles = [me, mara, noe]
  const climbs = [
    {
      id: 'c1',
      user_id: mara.id,
      climb_date: '2026-09-21',
      start_time: '18:00:00',
      end_time: '20:00:00',
      start_slot: null,
      end_slot: null,
      gym_id: null,
      custom_gym_name: 'BHive',
      gym_id_2: null,
      custom_gym_name_2: null,
      note: null,
      created_at: stamp,
      updated_at: stamp,
      gym: null,
      gym_2: null,
    },
    {
      id: 'c2',
      user_id: noe.id,
      climb_date: '2026-09-22',
      start_time: null,
      end_time: null,
      start_slot: 'Opening',
      end_slot: 'Before Lunch',
      gym_id: null,
      custom_gym_name: 'The Wall',
      gym_id_2: null,
      custom_gym_name_2: null,
      note: 'First time back since the knee.',
      created_at: stamp,
      updated_at: stamp,
      gym: null,
      gym_2: null,
    },
  ]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters, op }) => {
      if (table === 'gyms') {
        if (gymFailure.value && (op === 'insert' || op === 'update' || op === 'delete')) {
          return { data: null, error: gymFailure.value }
        }
        if (op === 'insert') {
          const row = {
            id: `g${gymRows.length + 1}`,
            created_by: null,
            created_at: stamp,
            ...(filters.__values as Record<string, unknown>),
          }
          gymRows.push(row)
          return { data: row, error: null }
        }
        if (op === 'delete') return { data: null, error: null }
        return { data: [...gymRows], error: null }
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
        const publicOnly = filters.visibility === 'public'
        return { data: profiles.filter((p) => !publicOnly || p.visibility === 'public'), error: null }
      }

      if (table === 'climbs') return { data: climbs, error: null }
      if (table === 'friendships') return { data: [], error: null }
      return { data: null, error: null }
    }),
  }
})

function renderAdmin() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

async function unlock() {
  fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'ilikepie' } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
}

describe('<Admin />', () => {
  beforeEach(() => {
    sessionStorage.clear()
    gymFailure.value = null
    gymRows.length = 0
    gymRows.push({
      id: 'g1',
      name: 'BHive',
      region: 'Luzon',
      city: null,
      created_by: null,
      created_at: stamp,
    })
  })

  it('asks for the password, and refuses a wrong one', async () => {
    renderAdmin()

    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'letmein' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('That is not the password.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Numbers' })).toBeNull()
  })

  it('unlocks with the password and reports the numbers', async () => {
    renderAdmin()
    await unlock()

    expect(await screen.findByRole('heading', { name: 'Numbers' })).toBeTruthy()
    // head/count queries: 3 climbers (2 of them public), 1 gym, 2 sessions ahead.
    expect(screen.getByText('Climbers').parentElement?.textContent).toContain('3')
    expect(screen.getByText('Gyms listed').parentElement?.textContent).toContain('1')
    expect(screen.getByText('Sessions ahead').parentElement?.textContent).toContain('2')
  })

  it('lists every climb with the climber who logged it - private profiles too', async () => {
    renderAdmin()
    await unlock()

    expect(await screen.findByRole('heading', { name: 'Climbs' })).toBeTruthy()
    const list = await screen.findByRole('list', { name: 'Climbs' })

    // A public climber's session…
    expect(within(list).getByText('Mara')).toBeTruthy()
    expect(within(list).getByText('@mara')).toBeTruthy()
    expect(within(list).getByText('BHive')).toBeTruthy()
    expect(within(list).getByText(/18:00 – 20:00/)).toBeTruthy()

    // …and one from a profile set to private, which the feed would never show.
    expect(within(list).getByText('Noe')).toBeTruthy()
    expect(within(list).getByText('@noe')).toBeTruthy()
    expect(within(list).getByText('The Wall')).toBeTruthy()
    expect(within(list).getByText(/Opening – Before Lunch/)).toBeTruthy()
    expect(within(list).getByText('First time back since the knee.')).toBeTruthy()

    // One row per climb, whoever logged it.
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('filters the climb list by search and by climber visibility', async () => {
    renderAdmin()
    await unlock()

    const list = await screen.findByRole('list', { name: 'Climbs' })
    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'mara' } })

    // Searching a climber keeps their row and drops everyone else's.
    expect(within(list).getByText('Mara')).toBeTruthy()
    expect(within(list).queryByText('Noe')).toBeNull()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Climber visibility'), { target: { value: 'private' } })

    // The private filter reaches the private climber only - the point of the
    // section: visibility changes the feed, not the dashboard.
    expect(within(list).getByText('Noe')).toBeTruthy()
    expect(within(list).queryByText('Mara')).toBeNull()
  })

  it('adds a gym from the dashboard', async () => {
    renderAdmin()
    await unlock()

    fireEvent.change(await screen.findByLabelText('Gym name'), {
      target: { value: 'Edge Climb' },
    })
    fireEvent.change(screen.getByLabelText('City (optional)'), { target: { value: 'Makati' } })
    fireEvent.change(screen.getByLabelText('Region (optional)'), { target: { value: 'Luzon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add gym' }))

    expect(await screen.findByText('Edge Climb added.')).toBeTruthy()
    // …and the list reloads with the new gym. The notice lands first, so wait for
    // the row (its city is a nested span inside the name cell) before asserting.
    const city = await screen.findByText(/Makati/)
    expect(city.parentElement?.textContent).toContain('Edge Climb')
  })

  it('explains an RLS refusal instead of echoing the policy error', async () => {
    // What PostgREST returns when the signed-in profile is not an admin and the
    // gym write has no policy that admits it (see 20260920000400_admin.sql).
    gymFailure.value = {
      code: '42501',
      message: 'new row violates row-level security policy for table "gyms"',
    }

    renderAdmin()
    await unlock()

    fireEvent.change(await screen.findByLabelText('Gym name'), {
      target: { value: 'Climb Shack' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add gym' }))

    expect(await screen.findByText(/Only admins can change the gym list/)).toBeTruthy()
    expect(screen.queryByText(/row-level security policy/)).toBeNull()
  })

  it('deletes a gym once the confirmation is accepted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAdmin()
    await unlock()

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('BHive deleted.')).toBeTruthy()
    expect(confirm).toHaveBeenCalled()
  })
})