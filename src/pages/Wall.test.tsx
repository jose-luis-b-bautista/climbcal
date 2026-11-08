/**
 * The wall (guestbook) page: renders a climber's profile and notes, posts a note
 * through `profile_comments`, and keeps a private stranger's wall closed.
 *
 * The share page (`/u/<username>`) is deliberately not involved: a wall is an
 * in-app surface and needs a session.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'

const { state } = vi.hoisted(() => {
  const stamp = '2026-09-01T10:00:00.000Z'
  const profile = (id: string, username: string, display_name: string, visibility: string) => ({
    id,
    username,
    display_name,
    visibility,
    created_at: stamp,
    updated_at: stamp,
  })

  return {
    state: {
      rows: [] as Array<Record<string, unknown>>,
      ids: {
        me: '11111111-1111-1111-1111-111111111111',
        mara: '22222222-2222-2222-2222-222222222222',
        sam: '33333333-3333-3333-3333-333333333333',
      },
      profiles: [
        profile('11111111-1111-1111-1111-111111111111', 'luis', 'Luis', 'private'),
        profile('22222222-2222-2222-2222-222222222222', 'mara', 'Mara', 'public'),
        profile('33333333-3333-3333-3333-333333333333', 'sam', 'Sam', 'private'),
      ],
    },
  }
})

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('../test/supabaseMock')
  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, op, filters }) => {
      if (table === 'profile_comments') {
        if (op === 'insert') {
          const values = filters.__values as {
            profile_id: string
            user_id: string
            body: string
          }
          const row = {
            id: `note-${state.rows.length + 1}`,
            ...values,
            created_at: '2026-09-20T12:00:00.000Z',
            updated_at: '2026-09-20T12:00:00.000Z',
          }
          state.rows.push(row)
          return { data: row, error: null }
        }

        if (op === 'delete') {
          state.rows = state.rows.filter((row) => row.id !== filters.id)
          return { data: null, error: null }
        }

        return {
          data: state.rows.filter((row) => row.profile_id === filters.profile_id),
          error: null,
        }
      }

      if (table === 'profiles') {
        const single = filters.id
        if (typeof single === 'string') {
          return { data: state.profiles.find((profile) => profile.id === single) ?? null, error: null }
        }
        const ids = filters['in.id']
        return {
          data: state.profiles.filter(
            (profile) => !Array.isArray(ids) || ids.includes(profile.id),
          ),
          error: null,
        }
      }

      // No friendships: Mara is public, Sam is a private stranger.
      if (table === 'friendships') return { data: [], error: null }
      return { data: null, error: null }
    }),
  }
})

function renderWall(userId: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/wall/${userId}`]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('<Wall />', () => {
  beforeEach(() => {
    state.rows = []
  })

  it('opens a public climber’s wall with their notes', async () => {
    state.rows = [
      {
        id: 'note-seed',
        profile_id: state.ids.mara,
        user_id: state.ids.me,
        body: 'Good luck on the project!',
        created_at: '2026-09-20T10:00:00.000Z',
        updated_at: '2026-09-20T10:00:00.000Z',
      },
    ]

    renderWall(state.ids.mara)

    expect(await screen.findByRole('heading', { name: /mara's wall/i })).toBeTruthy()
    expect(await screen.findByText('Good luck on the project!')).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('posts a note onto the wall it is opened for', async () => {
    renderWall(state.ids.mara)

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'Climbing Sunday?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    expect(await screen.findByText('Climbing Sunday?')).toBeTruthy()
    expect(state.rows.find((row) => row.body === 'Climbing Sunday?')).toMatchObject({
      profile_id: state.ids.mara,
      user_id: state.ids.me,
    })
  })

  it('keeps a private stranger’s wall closed', async () => {
    renderWall(state.ids.sam)

    expect(await screen.findByText(/keeps their wall for friends/i)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
