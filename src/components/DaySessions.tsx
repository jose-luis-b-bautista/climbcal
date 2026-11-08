import { useMemo } from 'react'
import { formatDayLabel, sessionTiming, toISODate } from '../lib/date'
import type { Climb, ClimbEntry } from '../types'
import { SessionCard } from './SessionCard'
import { Card, Disclosure, cx, ghostButtonClass, subTextClass } from './ui'

interface DaySessionsProps {
  kind: 'today' | 'tomorrow'
  /** The day being shown - already resolved to today or tomorrow. */
  date: Date
  entries: ClimbEntry[]
  userId: string | null
  /** True while the two-day query is still in flight, so nothing flashes empty. */
  loading?: boolean
  /** Comment counts for the sessions on screen (one batched query per page). */
  commentCounts?: Record<string, number>
  onAdd: (dateISO: string) => void
  onEdit: (climb: Climb) => void
}

/**
 * Single-day summary; the calendar page stacks Today and Tomorrow over the week.
 *
 * Each card folds away on its own and **starts open**: the next two days are why
 * the page gets opened, so hiding them behind a tap would be backwards - and on a
 * phone the fold is still one click away when the week grid needs the room. The
 * label and the date stay on screen either way.
 */
export function DaySessions({
  kind,
  date,
  entries,
  userId,
  loading = false,
  commentCounts = {},
  onAdd,
  onEdit,
}: DaySessionsProps) {
  const dateISO = toISODate(date)
  const label = kind === 'today' ? 'Today' : 'Tomorrow'

  // Captured once: the "On now" badges are a snapshot, not a ticking clock.
  const now = useMemo(() => new Date(), [])

  return (
    <Card>
      <Disclosure
        title={label}
        // Open on arrival: today's plan is the first thing a climber came for.
        defaultOpen
        // The date rides on the label's baseline; the heading stays just "Today".
        meta={<p className="text-sm text-zinc-500">{formatDayLabel(date)}</p>}
        panelClassName="mt-4"
      >
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
          <div className="divide-y divide-zinc-800/60">
            {entries.map((entry) => (
              <SessionCard
                key={entry.id}
                entry={entry}
                // The day card is the box; sessions are rows separated by a rule.
                variant="flat"
                isOwn={entry.user_id === userId}
                viewerId={userId}
                commentCount={commentCounts[entry.id]}
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
      </Disclosure>
    </Card>
  )
}