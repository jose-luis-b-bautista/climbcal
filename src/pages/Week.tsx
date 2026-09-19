import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SessionFormModal } from '../components/SessionFormModal'
import {
  Avatar,
  EmptyState,
  ErrorBanner,
  Notice,
  PageLoader,
  SectionHeading,
  cx,
  ghostButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useGyms } from '../hooks/useGyms'
import { groupByDate, useWeekClimbs } from '../hooks/useWeekClimbs'
import {
  DAY_NAMES_SHORT,
  addWeeks,
  formatDuration,
  formatShortDate,
  formatTimeWindow,
  formatWeekRange,
  isToday,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDays,
} from '../lib/date'
import { displayNameOf, gymNameOf } from '../lib/format'
import type { Climb, ClimbEntry } from '../types'

interface SessionCardProps {
  entry: ClimbEntry
  isOwn: boolean
  onEdit: (climb: Climb) => void
}

function SessionCard({ entry, isOwn, onEdit }: SessionCardProps) {
  return (
    <div
      className={cx(
        'mb-2 rounded-lg border p-2.5',
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
          <p className="truncate text-xs text-zinc-400">{gymNameOf(entry)}</p>
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-emerald-300">
        {formatTimeWindow(entry.start_time, entry.end_time)}
        <span className="text-zinc-500"> · {formatDuration(entry.start_time, entry.end_time)}</span>
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

/** Resolves the `?week=YYYY-MM-DD` param into a Monday, defaulting to today. */
function resolveWeekStart(param: string | null): Date {
  if (!param) return startOfWeek(new Date())
  const parsed = parseISODate(param)
  if (Number.isNaN(parsed.getTime())) return startOfWeek(new Date())
  return startOfWeek(parsed)
}

export default function Week() {
  const { userId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { friendIds, friends, loading: friendsLoading, error: friendsError } = useFriends()
  const { gyms } = useGyms()

  const weekStart = useMemo(() => resolveWeekStart(searchParams.get('week')), [searchParams])
  const weekStartDate = toISODate(weekStart)
  const weekEndDate = toISODate(weekDays(weekStart)[6])
  const days = useMemo(() => weekDays(weekStart), [weekStart])

  const participantIds = useMemo(
    () => (userId ? [userId, ...friendIds] : null),
    [userId, friendIds],
  )

  const { entries, loading, error, reload } = useWeekClimbs(
    weekStartDate,
    weekEndDate,
    participantIds,
    Boolean(userId),
  )

  const [modal, setModal] = useState<{ open: boolean; date: string; initial: Climb | null }>({
    open: false,
    date: weekStartDate,
    initial: null,
  })

  const byDate = useMemo(() => {
    const map = new Map<string, ClimbEntry[]>()
    for (const group of groupByDate(entries)) map.set(group.date, group.entries)
    return map
  }, [entries])

  const todayISO = toISODate(new Date())
  const isCurrentWeek = weekStartDate === toISODate(startOfWeek(new Date()))
  const friendCountTotal = useMemo(
    () =>
      new Set(entries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id)).size,
    [entries, userId],
  )

  const goToWeek = (offset: number) => {
    setSearchParams({ week: toISODate(addWeeks(weekStart, offset)) })
  }

  return (
    <div>
      <SectionHeading
        title="Weekly climbing calendar"
        hint={`${formatWeekRange(weekStart)} · ${
          friendCountTotal === 0
            ? 'no friends climbing'
            : `${friendCountTotal} friend${friendCountTotal === 1 ? '' : 's'} climbing`
        }`}
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={reload} className={ghostButtonClass}>
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setModal({ open: true, date: todayISO, initial: null })}
            >
              + Add session
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryButtonClass} onClick={() => goToWeek(-1)}>
          ← Prev
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => setSearchParams({})}
          disabled={isCurrentWeek}
        >
          This week
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => goToWeek(1)}>
          Next →
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {friendsError ? <ErrorBanner message={friendsError} /> : null}

      {!friendsLoading && friends.length === 0 ? (
        <div className="mb-4">
          <Notice>
            You have no friends yet, so this shows only your own sessions.{' '}
            <Link to="/friends" className="font-semibold underline">
              Find climbers
            </Link>{' '}
            to see their weeks too.
          </Notice>
        </div>
      ) : null}

      {loading ? (
        <PageLoader label="Loading this week…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day, index) => {
            const dateISO = toISODate(day)
            const dayEntries = byDate.get(dateISO) ?? []
            const friendCount = new Set(
              dayEntries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id),
            ).size
            const today = isToday(day) && isCurrentWeek

            return (
              <section
                key={dateISO}
                className={cx(
                  'rounded-xl border p-3',
                  today
                    ? 'border-emerald-800/70 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/30',
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-1">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {DAY_NAMES_SHORT[index]}{' '}
                      <span className="font-normal text-zinc-500">{formatShortDate(day)}</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {friendCount === 0
                        ? 'No friends yet'
                        : `${friendCount} friend${friendCount === 1 ? '' : 's'} climbing`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal({ open: true, date: dateISO, initial: null })}
                    className="rounded-md border border-zinc-700 px-1.5 text-sm leading-6 text-zinc-400 hover:border-emerald-700 hover:text-emerald-300"
                    aria-label={`Add a session on ${dateISO}`}
                    title="Add a session on this day"
                  >
                    +
                  </button>
                </div>

                {dayEntries.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 px-2 py-4 text-center text-xs text-zinc-600">
                    Nothing planned
                  </p>
                ) : (
                  dayEntries.map((entry) => (
                    <SessionCard
                      key={entry.id}
                      entry={entry}
                      isOwn={entry.user_id === userId}
                      onEdit={(climb) =>
                        setModal({ open: true, date: climb.climb_date, initial: climb })
                      }
                    />
                  ))
                )}
              </section>
            )
          })}
        </div>
      )}

      {!loading && entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Bone dry week"
            hint="Add your own sessions so friends know when to meet you at the wall."
          />
        </div>
      ) : null}

      {modal.open ? (
        <SessionFormModal
          key={modal.initial?.id ?? `new-${modal.date}`}
          userId={userId ?? ''}
          gyms={gyms}
          defaultDate={modal.date}
          initial={modal.initial}
          onClose={() => setModal((current) => ({ ...current, open: false }))}
          onSaved={reload}
          onDeleted={reload}
        />
      ) : null}
    </div>
  )
}
