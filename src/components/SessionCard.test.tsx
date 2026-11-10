/**
 * The card's comment toggle must sit beside the session's hours, not in a footer
 * under the note. The thread itself is mocked: this file only covers placement,
 * and the real thread (and its Supabase calls) is tested in Comments.test.tsx.
 */
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SessionCard } from './SessionCard'
import type { ClimbEntry } from '../types'

vi.mock('./Comments', () => ({
  SessionComments: ({ action }: { action?: ReactNode }) => (
    <div data-testid="thread">
      <button type="button">Comments</button>
      {action}
    </div>
  ),
}))

const profile = {
  id: 'user-1',
  username: 'luis',
  display_name: 'Luis',
  visibility: 'public' as const,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
}

function entry(overrides: Partial<ClimbEntry> = {}): ClimbEntry {
  return {
    id: 'climb-1',
    user_id: 'user-1',
    climb_date: '2026-09-16',
    start_time: '18:30:00',
    end_time: '21:00:00',
    start_slot: null,
    end_slot: null,
    gym_id: 'gym-1',
    custom_gym_name: null,
    gym_id_2: null,
    custom_gym_name_2: null,
    note: null,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    gym: { id: 'gym-1', name: 'Vertical Hub' },
    gym_2: null,
    climber: profile,
    ...overrides,
  }
}

function renderCard(overrides: Partial<ClimbEntry> = {}) {
  return render(
    <SessionCard entry={entry(overrides)} isOwn viewerId="user-1" onEdit={() => {}} />,
  )
}

describe('<SessionCard />', () => {
  it('keeps the comment toggle on the time row', () => {
    renderCard()

    const time = screen.getByText(/18:30/)
    const thread = screen.getByTestId('thread')

    // Same row as the hours: the count is not buried in a footer.
    expect(thread.parentElement).toBe(time.parentElement)
    expect(
      time.compareDocumentPosition(thread) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('puts the note under the time row instead of between it and the toggle', () => {
    renderCard({ note: 'Bring the rope' })

    const time = screen.getByText(/18:30/)
    const note = screen.getByText('Bring the rope')

    expect(time.parentElement).not.toBe(note.parentElement)
    expect(
      time.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
