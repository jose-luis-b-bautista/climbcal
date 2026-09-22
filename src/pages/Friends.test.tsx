/**
 * Friends page — the "Find climbers" section: the list of newest public climbers
 * to add, the username search (clearing the box drops the results) and how a
 * sent request reads in both.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

// Hoisted so the test can reset it between cases while the mock factory uses it.
const { friendships } = vi.hoisted(() => ({
  friendships: [] as Array<Record<string, string>>,
}))

vi.mock('../lib/supabase', async () => {
  const { TEST_USER_ID, createSupabaseMock } = await import('../test/supabaseMock')
  const stamp = '2026-09-01T00:00:00.000Z'
  const maraId = '22222222-2222-2222-2222-222222222222'
  const noorId = '33333333-3333-3333-3333-333333333333'
  const samId = '44444444-4444-4444-4444-444444444444'

  const profile = (
    id: string,
    username: string,
    display_name: string | null,
    visibility: 'public' | 'private',
    createdAt: string,
  ) => ({ id, username, display_name, visibility, created_at: createdAt, updated_at: createdAt })

  // `created_at` doubles as "who joined last", so noor is the newest climber.
  const me = profile(TEST_USER_ID, 'luis', 'Luis', 'private', '2026-08-01T00:00:00.000Z')
  const sam = profile(samId, 'sam', 'Sam', 'private', '2026-08-02T00:00:00.000Z')
  const mara = profile(maraId, 'mara', 'Mara', 'public', '2026-08-03T00:00:00.000Z')
  const noor = profile(noorId, 'noor', 'Noor', 'public', '2026-08-04T00:00:00.000Z')
  const profiles = [me, sam, mara, noor]

  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, filters, op }) => {
      if (table === 'friendships') {
        if (op === 'insert') {
          const row = { id: `f${friendships.length + 1}`, created_at: stamp, updated_at: stamp, ...(filters.__values as Record<string, string>) }
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
                Boolean(profile.username.toLowerCase().includes(needle)),
            ),
            error: null,
          }
        }
        // "Newest climbers to add": public, not me, most recent first.
        if (filters.visibility === 'public') {
          return {
            data: profiles
              .filter((profile) => profile.visibility === 'public' && profile.id !== TEST_USER_ID)
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
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

describe('<Friends /> find climbers', () => {
  beforeEach(() => {
    friendships.length = 0
  })

  it('lists public climbers to add, newest first', async () => {
    renderFriends()

    // noor joined last, so they lead the list; the handles mark each row.
    expect(await screen.findByText('@noor')).toBeTruthy()
    expect(screen.getByText('Newest climbers to add')).toBeTruthy()
    expect(screen.getAllByText(/^@(noor|mara)$/).map((node) => node.textContent)).toEqual([
      '@noor',
      '@mara',
    ])

    // Private climbers are not offered, and neither is yourself (the header
    // prints your handle too, which is the one occurrence left).
    expect(screen.queryByText('@sam')).toBeNull()
    expect(screen.getAllByText('@luis')).toHaveLength(1)
  })

  it('moves a climber into "Sent requests" once added from the list', async () => {
    renderFriends()

    expect(await screen.findAllByRole('button', { name: 'Add friend' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add friend' })[0])

    // The newest climber is gone from the list…
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Add friend' })).toHaveLength(1),
    )
    // …and shows up as a pending request below, with its cancel.
    expect(screen.getByRole('heading', { name: 'Sent requests' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1)
  })

  it('clears the previous results when the search box is emptied', async () => {
    renderFriends()

    // 'sam' is private, so he can only be found by searching — which is what
    // tells the results apart from the suggestions list.
    await searchFor('sam')
    expect(await screen.findByText('@sam')).toBeTruthy()
    expect(screen.queryByText('Newest climbers to add')).toBeNull()

    // The field's own clear (×) only empties the input, so the stale climber
    // has to go with it — and no "no climbers matched" note either.
    fireEvent.change(screen.getByLabelText('Search climbers by username'), {
      target: { value: '' },
    })

    expect(screen.queryByText('@sam')).toBeNull()
    expect(screen.queryByText('No climbers matched that username.')).toBeNull()
    // …and the suggestions list is back.
    expect(await screen.findByText('@noor')).toBeTruthy()
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