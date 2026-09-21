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
  subTextClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useGyms } from '../hooks/useGyms'
import { groupByDate, useWeekClimbs } from '../hooks/useWeekClimbs'
import {
  DAY_NAMES_SHORT,
  addDays,
  addWeeks,
  formatShortDate,
  formatWeekRange,
  isToday,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDays,
} from '../lib/date'
import type { Climb, ClimbEntry } from '../types'

/** Resolves the `?week=YYYY-MM-DD` param into a Monday, defaulting to this week. */
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

  // "Today" is captured once per mount so the day cards and the grid agree.
  const today = useMemo(() => new Date(), [])
  const tomorrow = useMemo(() => addDays(today, 1), [today])
  const todayISO = toISODate(today)
  const tomorrowISO = toISODate(tomorrow)

  const weekStart = useMemo(() => resolveWeekStart(searchParams.get('week')), [searchParams])
  const weekStartDate = toISODate(weekStart)
  const weekEndDate = toISODate(addDays(weekStart, 6))
  const days = useMemo(() => weekDays(weekStart), [weekStart])

  const participantIds = useMemo(
    () => (userId ? [userId, ...friendIds] : null),
    [userId, friendIds],
  )

  // Two queries on purpose: the day cards always describe the real today and
  // tomorrow, whatever week the grid below is parked on.
  const {
    entries: upcoming,
    loading: upcomingLoading,
    error: upcomingError,
    reload: reloadUpcoming,
  } = useWeekClimbs(todayISO, tomorrowISO, participantIds, Boolean(userId))

  const {
    entries: weekEntries,
    loading: weekLoading,
    error: weekError,
    reload: reloadWeek,
  } = useWeekClimbs(weekStartDate, weekEndDate, participantIds, Boolean(userId))

  const reload = () => {
    reloadUpcoming()
    reloadWeek()
  }

  // Both queries fail together in practice, so surface a single banner.
  const dataError = upcomingError ?? weekError

  const [modal, setModal] = useState<{ open: boolean; date: string; initial: Climb | null }>({
    open: false,
    date: todayISO,
    initial: null,
  })

  const byDate = useMemo(() => {
    const map = new Map<string, ClimbEntry[]>()
    for (const group of groupByDate(weekEntries)) map.set(group.date, group.entries)
    return map
  }, [weekEntries])

  /** The two-day query feeds both day cards, so split it by date here. */
  const dayEntries = (dateISO: string) => upcoming.filter((entry) => entry.climb_date === dateISO)

  const isCurrentWeek = weekStartDate === toISODate(startOfWeek(today))
  const friendCountTotal = useMemo(
    () =>
      new Set(weekEntries.filter((entry) => entry.user_id !== userId).map((entry) => entry.user_id))
        .size,
    [weekEntries, userId],
  )
  const friendLabel =
    friendCountTotal === 0
      ? 'no friends climbing'
      : `${friendCountTotal} friend${friendCountTotal === 1 ? '' : 's'} climbing`

  const goToWeek = (offset: number) => {
    setSearchParams({ week: toISODate(addWeeks(weekStart, offset)) })
  }

  return (
    <div>
      <SectionHeading
        title="Climbing calendar"
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

      <div className="space-y-6">
        {dataError ? <ErrorBanner message={dataError} /> : null}
        {friendsError ? <ErrorBanner message={friendsError} /> : null}

        {!friendsLoading && friends.length === 0 ? (
          <Notice>
            You have no friends yet, so this shows only your own sessions.{' '}
            <Link to="/friends" className="font-semibold underline">
              Find climbers
            </Link>{' '}
            to see their weeks too.
          </Notice>
        ) : null}

        <DaySessions
          kind="today"
          date={today}
          entries={dayEntries(todayISO)}
          userId={userId}
          loading={upcomingLoading}
          onAdd={(date) => setModal({ open: true, date, initial: null })}
          onEdit={(climb) => setModal({ open: true, date: climb.climb_date, initial: climb })}
        />

        <DaySessions
          kind="tomorrow"
          date={tomorrow}
          entries={dayEntries(tomorrowISO)}
          userId={userId}
          loading={upcomingLoading}
          onAdd={(date) => setModal({ open: true, date, initial: null })}
          onEdit={(climb) => setModal({ open: true, date: climb.climb_date, initial: climb })}
        />

        <section>
          <SectionHeading
            title="Week"
            hint={`${formatWeekRange(weekStart)} · ${friendLabel}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
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
            }
          />

          {weekLoading ? (
            <PageLoader label="Loading this week…" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {days.map((day, index) => {
                  const dateISO = toISODate(day)
                  const columnEntries = byDate.get(dateISO) ?? []
                  const friendCount = new Set(
                    columnEntries
                      .filter((entry) => entry.user_id !== userId)
                      .map((entry) => entry.user_id),
                  ).size
                  const isTodayColumn = isToday(day) && isCurrentWeek

                  return (
                    <div
                      key={dateISO}
                      className={cx(
                        'rounded-xl border p-3',
                        isTodayColumn
                          ? 'border-emerald-800/70 bg-emerald-950/20'
                          : 'border-zinc-800 bg-zinc-900/30',
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-1">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {DAY_NAMES_SHORT[index]}{' '}
                            <span className="font-normal text-zinc-500">
                              {formatShortDate(day)}
                            </span>
                          </p>
                          <p className={subTextClass}>
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

                      {columnEntries.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-zinc-800 px-2 py-4 text-center text-xs text-zinc-500">
                          Nothing planned
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {columnEntries.map((entry) => (
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
                    </div>
                  )
                })}
              </div>

              {weekEntries.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    title="Bone dry week"
                    hint="Add your own sessions so friends know when to meet you at the wall."
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

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
