import { useMemo } from 'react'
import { formatDayLabel, sessionTiming, toISODate } from '../lib/date'
import type { Climb, ClimbEntry } from '../types'
import { SessionCard } from './SessionCard'
import { Card, cx, ghostButtonClass, subTextClass } from './ui'

interface DaySessionsProps {
  kind: 'today' | 'tomorrow'
  /** The day being shown — already resolved to today or tomorrow. */
  date: Date
  entries: ClimbEntry[]
  userId: string | null
  /** True while the two-day query is still in flight, so nothing flashes empty. */
  loading?: boolean
  onAdd: (dateISO: string) => void
  onEdit: (climb: Climb) => void
}

/** Single-day summary; the calendar page stacks Today and Tomorrow over the week. */
export function DaySessions({
  kind,
  date,
  entries,
  userId,
  loading = false,
  onAdd,
  onEdit,
}: DaySessionsProps) {
  const dateISO = toISODate(date)
  const label = kind === 'today' ? 'Today' : 'Tomorrow'

  // Captured once: the "On now" badges are a snapshot, not a ticking clock.
  const now = useMemo(() => new Date(), [])

  const ownCount = entries.filter((entry) => entry.user_id === userId).length
  const friendCount = new Set(
    entries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id),
  ).size

  // The day summary is the social signal only: the session count duplicates the
  // cards below, and the friends line is what a phone needs at a glance.
  const summary = loading
    ? 'Loading sessions…'
    : entries.length === 0
      ? 'Nobody has posted a session yet.'
      : friendCount === 0
        ? 'no friends climbing'
        : `${friendCount} friend${friendCount === 1 ? '' : 's'} climbing`

  const nudge =
    loading || entries.length === 0
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
      {nudge ? <p className={cx('mt-1', subTextClass)}>{nudge}</p> : null}

      <div className="mt-4">
        {loading ? null : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center">
            <p className="text-sm font-medium text-zinc-300">
              {kind === 'today' ? 'Nothing on today' : 'Nothing on tomorrow'}
            </p>
            <p className={cx('mt-1', subTextClass)}>
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