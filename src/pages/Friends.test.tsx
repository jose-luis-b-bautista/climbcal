/**
 * Friends page — the "Find climbers" search: clearing the box has to take the
 * previous results with it, and a sent request shows as "Request sent" with no
 * cancel button in the results (that lives in "Sent requests" below).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

vi.mock('../lib/supabase', async () => {
  const { TEST_USER_ID, createSupabaseMock } = await import('../test/supabaseMock')
  const stamp = '2026-09-01T00:00:00.000Z'
  const maraId = '22222222-2222-2222-2222-222222222222'

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
  const profiles = [me, mara]

  // Mutable, so an inserted request turns up on the hook's next reload.
  const friendships: Array<Record<string, string>> = []

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters, op }) => {
      if (table === 'friendships') {
        if (op === 'insert') {
          const row = { id: 'f1', created_at: stamp, updated_at: stamp, ...(filters.__values as Record<string, string>) }
          friendships.push(row)
          return { data: row, error: null }
        }
        // A fresh array each time, like PostgREST: the hook memoises on the rows
        // reference, so handing back the same (mutated) array would go stale.
        return { data: [...friendships], error: null }
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
        const pattern = filters['ilike.username']
        if (typeof pattern === 'string') {
          const needle = pattern.replaceAll('%', '').toLowerCase()
          return {
            data: profiles.filter(
              (profile) =>
                profile.id !== TEST_USER_ID &&
                Boolean(profile.username?.toLowerCase().includes(needle)),
            ),
            error: null,
          }
        }
        return { data: profiles, error: null }
      }

      return { data: null, error: null }
    }),
  }
})

function renderFriends() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/friends']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

/** Waits for the page (auth + friends load first) before typing a search. */
async function searchFor(term: string) {
  const field = await screen.findByLabelText('Search climbers by username')
  fireEvent.change(field, { target: { value: term } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
}

describe('<Friends /> search', () => {
  it('clears the previous results when the search box is emptied', async () => {
    renderFriends()

    await searchFor('mara')
    expect(await screen.findByText('Mara')).toBeTruthy()

    // The field's own clear (×) only empties the input, so the stale climber
    // has to go with it — and no "no climbers matched" note either.
    fireEvent.change(screen.getByLabelText('Search climbers by username'), {
      target: { value: '' },
    })

    expect(screen.queryByText('Mara')).toBeNull()
    expect(screen.queryByText('No climbers matched that username.')).toBeNull()
  })

  it('shows a sent request as "Request sent" without a cancel button in the results', async () => {
    renderFriends()

    await searchFor('mara')
    expect(await screen.findByText('Mara')).toBeTruthy()
    expect(screen.queryAllByRole('button', { name: 'Cancel' })).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }))

    expect(await screen.findByText('Request sent')).toBeTruthy()
    // Exactly one Cancel on the page: the one under "Sent requests".
    expect(screen.getByRole('heading', { name: 'Sent requests' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1)
  })
})