import { formatDuration, formatTimeWindow, type SessionTiming } from '../lib/date'
import { displayNameOf } from '../lib/format'
import type { Climb, ClimbEntry } from '../types'
import { Avatar, GymCell, cx } from './ui'

export interface SessionCardProps {
  entry: ClimbEntry
  isOwn: boolean
  onEdit: (climb: Climb) => void
  /** Optional "On now" / "Starts in 45m" badge, used by the day views. */
  timing?: SessionTiming | null
}

const TIMING_CLASSES: Record<SessionTiming['state'], string> = {
  live: 'border-emerald-800 bg-emerald-950/60 text-emerald-300',
  soon: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  done: 'border-zinc-800 bg-zinc-900/60 text-zinc-500',
}

/** One climbing session: who, where, when — with an optional relative badge. */
export function SessionCard({ entry, isOwn, onEdit, timing }: SessionCardProps) {
  return (
    <div
      className={cx(
        'rounded-lg border p-2.5',
        isOwn ? 'border-emerald-700/70 bg-emerald-950/40' : 'border-zinc-800 bg-zinc-900/60',
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

      {isOwn ? (
        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="mt-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          Edit
        </button>
      ) : null}
    </div>
  )
}