/**
 * The hidden /admin route: the password gate, the numbers, and gym management.
 *
 * Note what these tests do *not* prove: that the password protects anything. It
 * ships in the bundle, and the real gate is `profiles.is_admin` + RLS (verified
 * against Postgres in the migration notes).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

// Hoisted with the stamp: the `vi.mock` factory runs before module-level consts
// are initialised, so anything it reads at that point has to live in here.
const { gymRows, stamp } = vi.hoisted(() => ({
  gymRows: [] as Array<Record<string, unknown>>,
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
  const profiles = [me, mara]
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
  ]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters, op }) => {
      if (table === 'gyms') {
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
    // head/count queries: 2 climbers (both public), 1 gym, 1 session ahead.
    expect(screen.getByText('Climbers').parentElement?.textContent).toContain('2')
    expect(screen.getByText('Gyms listed').parentElement?.textContent).toContain('1')
    expect(screen.getByText('Sessions ahead').parentElement?.textContent).toContain('1')
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

  it('deletes a gym once the confirmation is accepted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAdmin()
    await unlock()

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('BHive deleted.')).toBeTruthy()
    expect(confirm).toHaveBeenCalled()
  })
})