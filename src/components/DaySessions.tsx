import { useMemo } from 'react'
import { formatDayLabel, formatTimeWindow, sessionTiming, toISODate } from '../lib/date'
import type { Climb, ClimbEntry } from '../types'
import { SessionCard } from './SessionCard'
import { Card, cx, ghostButtonClass } from './ui'

interface DaySessionsProps {
  kind: 'today' | 'tomorrow'
  /** The day being shown — already resolved to today or tomorrow. */
  date: Date
  entries: ClimbEntry[]
  userId: string | null
  onAdd: (dateISO: string) => void
  onEdit: (climb: Climb) => void
}

/** Focused single-day view behind the Today and Tomorrow tabs. */
export function DaySessions({ kind, date, entries, userId, onAdd, onEdit }: DaySessionsProps) {
  const dateISO = toISODate(date)
  const label = kind === 'today' ? 'Today' : 'Tomorrow'

  // Captured once: the "On now" badges are a snapshot, not a ticking clock.
  const now = useMemo(() => new Date(), [])

  const ownCount = entries.filter((entry) => entry.user_id === userId).length
  const friendCount = new Set(
    entries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id),
  ).size

  // entries arrive sorted by start time, so first start → last end is the day's span.
  const first = entries[0]
  const last = entries[entries.length - 1]
  const span = entries.length
    ? formatTimeWindow(first.start_time, last.end_time, first.start_slot, last.end_slot)
    : null

  const summary = entries.length
    ? [
        `${entries.length} session${entries.length === 1 ? '' : 's'}`,
        friendCount === 0
          ? 'no friends climbing'
          : `${friendCount} friend${friendCount === 1 ? '' : 's'} climbing`,
        span,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Nobody has posted a session yet.'

  const nudge =
    entries.length === 0
      ? null
      : ownCount === 0
        ? 'Your friends are out — add your own session to join them.'
        : friendCount === 0
          ? 'No friends have posted anything, so this one is all yours.'
          : null

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">{label}</h2>
        <p className="text-sm text-zinc-500">{formatDayLabel(date)}</p>
      </div>
      <p className="mt-1 text-sm text-zinc-400">{summary}</p>
      {nudge ? <p className="mt-1 text-xs text-zinc-500">{nudge}</p> : null}

      <div className="mt-4">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center">
            <p className="text-sm font-medium text-zinc-300">
              {kind === 'today' ? 'Nothing on today' : 'Nothing on tomorrow'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Post a session and your friends will see it here.
            </p>
            <button
              type="button"
              className={cx(ghostButtonClass, 'mt-3')}
              onClick={() => onAdd(dateISO)}
            >
              Add a session on {dateISO}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <SessionCard
                key={entry.id}
                entry={entry}
                isOwn={entry.user_id === userId}
                timing={
                  kind === 'today'
                    ? sessionTiming(
                        entry.climb_date,
                        entry.start_time,
                        entry.end_time,
                        now,
                        entry.start_slot,
                        entry.end_slot,
                      )
                    : null
                }
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}