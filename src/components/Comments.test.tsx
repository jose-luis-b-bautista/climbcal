/**
 * Session-comment thread coverage: collapsed by default (no request until it is
 * opened), author names, posting, the two delete rules (your own comment, or any
 * comment on your session), the 280-character cap, and the "migration not
 * applied" notice.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionComments } from './Comments'
import { AuthProvider } from '../hooks/useAuth'

// Everything the mock factory touches has to be hoisted with it.
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
      calls: [] as string[],
      missing: false,
      ids: {
        viewer: '11111111-1111-1111-1111-111111111111',
        owner: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        mara: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        climb: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
      profiles: [
        profile('11111111-1111-1111-1111-111111111111', 'luis', 'Luis', 'private'),
        profile('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', 'Owner', 'public'),
        profile('cccccccc-cccc-cccc-cccc-cccccccccccc', 'mara', 'Mara', 'public'),
      ],
    },
  }
})

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('../test/supabaseMock')
  return {
    isSupabaseConfigured: true,
    supabase: createSupabaseMock(({ table, op, filters }) => {
      state.calls.push(`${op}:${table}`)

      if (table === 'climb_comments') {
        if (state.missing) {
          return {
            data: null,
            error: {
              code: '42P01',
              message: 'relation "public.climb_comments" does not exist',
            },
          }
        }

        if (op === 'insert') {
          const values = filters.__values as {
            climb_id: string
            user_id: string
            body: string
          }
          const row = {
            id: `comment-${state.rows.length + 1}`,
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
          data: state.rows.filter((row) => row.climb_id === filters.climb_id),
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

      return { data: null, error: null }
    }),
  }
})

function renderThread(
  ownerId = state.ids.owner,
  display: 'inline' | 'sheet' = 'inline',
) {
  return render(
    <AuthProvider>
      <SessionComments
        climbId={state.ids.climb}
        ownerId={ownerId}
        viewerId={state.ids.viewer}
        count={1}
        display={display}
      />
    </AuthProvider>,
  )
}

function seedMaraComment() {
  state.rows = [
    {
      id: 'comment-seed',
      climb_id: state.ids.climb,
      user_id: state.ids.mara,
      body: 'I am in - bringing the rope.',
      created_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-20T10:00:00.000Z',
    },
  ]
}

describe('<SessionComments />', () => {
  beforeEach(() => {
    state.rows = []
    state.calls = []
    state.missing = false
  })

  it('stays collapsed until opened, and does not query the thread', async () => {
    renderThread()

    // Auth loads the profile, but the thread must not be requested yet.
    await waitFor(() => expect(state.calls).toContain('select:profiles'))
    expect(state.calls).not.toContain('select:climb_comments')
    expect(screen.queryByText('I am in - bringing the rope.')).toBeNull()
  })

  it('shows the thread, its count and the author when opened', async () => {
    seedMaraComment()
    renderThread()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))

    expect(await screen.findByText('I am in - bringing the rope.')).toBeTruthy()
    expect(screen.getByText('Mara')).toBeTruthy()
    expect(state.calls).toContain('select:climb_comments')
  })

  it('posts a comment and shows it straight away', async () => {
    renderThread()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: '  See you at 7  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))

    expect(await screen.findByText('See you at 7')).toBeTruthy()

    const inserted = state.rows.find((row) => row.body === 'See you at 7')
    expect(inserted).toMatchObject({
      climb_id: state.ids.climb,
      user_id: state.ids.viewer,
      body: 'See you at 7',
    })
  })

  it('caps the composer at 280 characters and disables an empty post', async () => {
    renderThread()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    expect(box.maxLength).toBe(280)
    expect((screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lets the session owner delete another climber’s comment', async () => {
    seedMaraComment()
    // The viewer owns this session, so their rule applies to its whole thread.
    renderThread(state.ids.viewer)

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))
    const remove = await screen.findByRole('button', { name: /delete comment by mara/i })

    // Two taps: ask, then delete.
    fireEvent.click(remove)
    fireEvent.click(screen.getByRole('button', { name: /confirm delete comment by mara/i }))

    await waitFor(() => {
      expect(screen.queryByText('I am in - bringing the rope.')).toBeNull()
    })
    expect(state.calls).toContain('delete:climb_comments')
  })

  it('shows no delete control to a climber who owns neither the comment nor the session', async () => {
    seedMaraComment()
    renderThread()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))
    expect(await screen.findByText('I am in - bringing the rope.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /delete comment/i })).toBeNull()
  })

  it('puts the toggle first on a left-aligned row, with its action beside it', async () => {
    render(
      <AuthProvider>
        <SessionComments
          climbId={state.ids.climb}
          ownerId={state.ids.owner}
          viewerId={state.ids.viewer}
          count={1}
          action={<button type="button">Edit</button>}
        />
      </AuthProvider>,
    )

    const toggle = screen.getByRole('button', { name: /comments/i })
    const edit = screen.getByRole('button', { name: 'Edit' })

    // Same row, comments first: no more "pinned to the right end".
    expect(edit.parentElement).toBe(toggle.parentElement)
    expect(
      toggle.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(toggle.parentElement?.className).toContain('-ml-2')

    fireEvent.click(toggle)

    // The panel is the row's sibling, so it spans the card instead of being
    // sized by the flex row (which is what made it look narrow on desktop).
    const panel = document.getElementById(toggle.getAttribute('aria-controls') as string)
    expect(panel).toBeTruthy()
    expect(panel?.parentElement).toBe(toggle.parentElement?.parentElement)
    expect(panel?.className).toContain('w-full')
  })

  it('opens a narrow host’s thread in a sheet, and Escape closes it', async () => {
    seedMaraComment()
    renderThread(state.ids.owner, 'sheet')

    // Compact toggle: no in-card panel until it is opened.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('I am in - bringing the rope.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Comments' })
    expect(within(dialog).getByText('I am in - bringing the rope.')).toBeTruthy()
    expect(within(dialog).getByRole('textbox')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('points at the migration when the tables are not deployed', async () => {
    state.missing = true
    renderThread()

    fireEvent.click(screen.getByRole('button', { name: /comments/i }))

    expect(await screen.findByText(/not in the database yet/i)).toBeTruthy()
    expect(screen.getByText(/20261110000000_comments\.sql/)).toBeTruthy()
  })
})
