import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DaySessions } from '../components/DaySessions'
import { SessionCard } from '../components/SessionCard'
import { SessionFormModal } from '../components/SessionFormModal'
import {
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
  addDays,
  addWeeks,
  formatDayLabel,
  formatShortDate,
  formatWeekRange,
  isToday,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDays,
} from '../lib/date'
import type { Climb, ClimbEntry } from '../types'

type WeekView = 'today' | 'tomorrow' | 'week'

const VIEWS: Array<{ value: WeekView; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'Week' },
]

/** Resolves the `?week=YYYY-MM-DD` param into a Monday, defaulting to today. */
function resolveWeekStart(param: string | null): Date {
  if (!param) return startOfWeek(new Date())
  const parsed = parseISODate(param)
  if (Number.isNaN(parsed.getTime())) return startOfWeek(new Date())
  return startOfWeek(parsed)
}

/** Resolves the `?view=` param, defaulting to the Mon–Sun grid. */
function resolveView(param: string | null): WeekView {
  return param === 'today' || param === 'tomorrow' ? param : 'week'
}

export default function Week() {
  const { userId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { friendIds, friends, loading: friendsLoading, error: friendsError } = useFriends()
  const { gyms } = useGyms()

  // "Today" is captured once per mount; which day is in focus comes from the URL.
  const today = useMemo(() => new Date(), [])
  const todayISO = toISODate(today)

  const view = resolveView(searchParams.get('view'))
  const focusDate = view === 'tomorrow' ? addDays(today, 1) : today
  const focusISO = toISODate(focusDate)

  const weekStart = useMemo(() => resolveWeekStart(searchParams.get('week')), [searchParams])
  const weekStartDate = toISODate(weekStart)
  const days = useMemo(() => weekDays(weekStart), [weekStart])

  // A focused day queries one date; the grid queries Mon–Sun.
  const rangeStart = view === 'week' ? weekStartDate : focusISO
  const rangeEnd = view === 'week' ? toISODate(addDays(weekStart, 6)) : focusISO

  const participantIds = useMemo(
    () => (userId ? [userId, ...friendIds] : null),
    [userId, friendIds],
  )

  const { entries, loading, error, reload } = useWeekClimbs(
    rangeStart,
    rangeEnd,
    participantIds,
    Boolean(userId),
  )

  const [modal, setModal] = useState<{ open: boolean; date: string; initial: Climb | null }>({
    open: false,
    date: todayISO,
    initial: null,
  })

  const byDate = useMemo(() => {
    const map = new Map<string, ClimbEntry[]>()
    for (const group of groupByDate(entries)) map.set(group.date, group.entries)
    return map
  }, [entries])

  const isCurrentWeek = weekStartDate === toISODate(startOfWeek(today))
  const friendCountTotal = useMemo(
    () =>
      new Set(entries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id)).size,
    [entries, userId],
  )
  const friendLabel =
    friendCountTotal === 0
      ? 'no friends climbing'
      : `${friendCountTotal} friend${friendCountTotal === 1 ? '' : 's'} climbing`

  const goToWeek = (offset: number) => {
    setSearchParams({ week: toISODate(addWeeks(weekStart, offset)) })
  }

  const showView = (next: WeekView) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'week') {
      // Keep whatever week the user was browsing; Today/Tomorrow don't need it.
      params.delete('view')
    } else {
      params.set('view', next)
      params.delete('week')
    }
    setSearchParams(params)
  }

  return (
    <div>
      <SectionHeading
        title="Weekly climbing calendar"
        hint={`${
          view === 'week' ? formatWeekRange(weekStart) : formatDayLabel(focusDate)
        } · ${friendLabel}`}
        action={
          <div className="flex items-center gap-2">
            <button type="button" onClick={reload} className={ghostButtonClass}>
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() =>
                setModal({ open: true, date: view === 'week' ? todayISO : focusISO, initial: null })
              }
            >
              + Add session
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Calendar view"
          className="inline-flex gap-1 rounded-lg bg-zinc-950/60 p-1"
        >
          {VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => showView(option.value)}
              className={cx(
                'rounded-md px-3 py-1.5 text-sm transition',
                view === option.value
                  ? 'bg-zinc-800 font-semibold text-zinc-100'
                  : 'font-medium text-zinc-400 hover:text-zinc-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {view === 'week' ? (
          <>
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
          </>
        ) : null}
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
        <PageLoader label={view === 'week' ? 'Loading this week…' : 'Loading…'} />
      ) : view === 'week' ? (
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
                  <p className="rounded-lg border border-dashed border-zinc-800 px-2 py-4 text-center text-xs text-zinc-500">
                    Nothing planned
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayEntries.map((entry) => (
                      <SessionCard
                        key={entry.id}
                        entry={entry}
                        isOwn={entry.user_id === userId}
                        onEdit={(climb) =>
                          setModal({ open: true, date: climb.climb_date, initial: climb })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <DaySessions
          kind={view}
          date={focusDate}
          entries={entries}
          userId={userId}
          onAdd={(date) => setModal({ open: true, date, initial: null })}
          onEdit={(climb) => setModal({ open: true, date: climb.climb_date, initial: climb })}
        />
      )}

      {!loading && view === 'week' && entries.length === 0 ? (
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
