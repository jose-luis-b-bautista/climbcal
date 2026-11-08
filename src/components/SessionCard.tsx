import { formatDuration, formatTimeWindow, type SessionTiming } from '../lib/date'
import { displayNameOf } from '../lib/format'
import type { Climb, ClimbEntry } from '../types'
import { SessionComments } from './Comments'
import { Avatar, GymCell, cx } from './ui'

export interface SessionCardProps {
  entry: ClimbEntry
  isOwn: boolean
  onEdit: (climb: Climb) => void
  /** Optional "On now" / "Finished" badge, used by the day views. */
  timing?: SessionTiming | null
  /**
   * Who is reading. Comments render only when this is set, which is what keeps
   * the public share page (`/u/<username>`) a read-only snapshot: it passes no
   * viewer, and anonymous visitors can never write there anyway.
   */
  viewerId?: string | null
  /** Count from the page's batched query (see `useCommentCounts`). */
  commentCount?: number
  /**
   * How the thread opens. The week grid's columns are ~150px wide, so its cards
   * pass `sheet` - an inline thread there would squeeze the composer and widen
   * the column. The day cards and feed rows keep the inline thread.
   */
  commentsDisplay?: 'inline' | 'sheet'
  /**
   * `card` draws the session as its own bordered box (week grid, share page);
   * `flat` makes it a row inside the day cards, where the Today/Tomorrow card is
   * the only box and rows are separated by a hairline instead of a second border.
   */
  variant?: 'card' | 'flat'
}

const TIMING_CLASSES: Record<SessionTiming['state'], string> = {
  live: 'border-emerald-800 bg-emerald-950/60 text-emerald-300',
  done: 'border-zinc-800 bg-zinc-900/60 text-zinc-500',
}

/** One climbing session: who, where, when - with an optional relative badge. */
export function SessionCard({
  entry,
  isOwn,
  onEdit,
  timing,
  viewerId,
  commentCount,
  commentsDisplay = 'inline',
  variant = 'card',
}: SessionCardProps) {
  // Comments sit first in the footer; this rides along on the same left-aligned
  // row via the thread's `action` slot.
  const editButton = isOwn ? (
    <button
      type="button"
      onClick={() => onEdit(entry)}
      className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-emerald-400 transition hover:text-emerald-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 sm:min-h-9"
    >
      Edit Session
    </button>
  ) : null

  return (
    <div
      className={cx(
        'min-w-0',
        variant === 'flat'
          ? cx(
              'py-2.5 first:pt-0 last:pb-0',
              // Your own session keeps a soft tint (no border) so the day card's
              // hairlines still run edge to edge.
              isOwn && 'bg-emerald-950/20',
            )
          : cx(
              'rounded-lg border p-2.5',
              isOwn
                ? 'border-emerald-700/70 bg-emerald-950/40'
                : 'border-zinc-800 bg-zinc-900/60',
            ),
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar profile={entry.climber} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">
            {displayNameOf(entry.climber)}
            {isOwn ? <span className="text-emerald-400"> (you)</span> : null}
          </p>
          <GymCell climb={entry} />
        </div>
        {timing ? (
          <span
            className={cx(
              'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              TIMING_CLASSES[timing.state],
            )}
          >
            {timing.label}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs font-medium text-emerald-300">
        {formatTimeWindow(entry.start_time, entry.end_time, entry.start_slot, entry.end_slot)}
        {/* A duration only makes sense when both ends are clock times. */}
        {entry.start_time && entry.end_time ? (
          <span className="text-zinc-500">
            {' '}
            · {formatDuration(entry.start_time, entry.end_time)}
          </span>
        ) : null}
      </p>

      {entry.note ? <p className="mt-1 text-xs text-zinc-400">{entry.note}</p> : null}

      {isOwn || viewerId ? (
        // Comments first, then Edit - both flush left, matching the feed. The
        // thread takes the Edit button as its `action` so the opened panel stays a
        // full-width sibling rather than a squeezed flex item.
        <div className="mt-1 border-t border-zinc-800/60 pt-1">
          {viewerId ? (
            <SessionComments
              climbId={entry.id}
              ownerId={entry.user_id}
              viewerId={viewerId}
              count={commentCount}
              display={commentsDisplay}
              action={editButton}
            />
          ) : (
            <div className="-ml-2 flex flex-wrap items-center gap-2">{editButton}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}