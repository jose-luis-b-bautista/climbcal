/**
 * Climbers feed.
 *
 * Two ways to read the same sessions:
 * - **List** — the next few weeks, grouped by day and then by gym ("who is going
 *   where"), so a gym with several climbers reads as one block.
 * - **Calendar** — a month of avatar dots; tapping a day opens that day's list
 *   underneath, so the grid stays scannable instead of carrying every card.
 *
 * Both include public profiles *and* your own sessions (whatever your own
 * visibility), because a feed that hid your own posts looked broken.
 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  GymCell,
  PageLoader,
  SectionHeading,
  Select,
  cx,
  ghostButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useGyms } from '../hooks/useGyms'
import { groupByDate, useClimbs } from '../hooks/useWeekClimbs'
import {
  DAY_NAMES_SHORT,
  addDays,
  addMonths,
  endOfMonth,
  formatDuration,
  formatMediumDate,
  formatMonthLabel,
  formatTimeWindow,
  isSameMonth,
  isToday,
  monthDays,
  parseISODate,
  parseISOMonth,
  startOfMonth,
  toISODate,
  toISOMonth,
} from '../lib/date'
import { climbGymNames, displayNameOf, groupGymsByRegion, usernameOf } from '../lib/format'
import { gymPaletteOf } from '../lib/gymColors'
import { groupByGym, indexByDate, uniqueClimbers, type GymGroup } from '../lib/group'
import type { ClimbEntry } from '../types'

type FeedView = 'list' | 'calendar'

/** Days ahead covered by the list view. */
const FEED_HORIZON_DAYS = 20

/** How many avatar dots a calendar day shows before it counts the rest. */
const CALENDAR_DOTS = 4

/** Resolves `?month=YYYY-MM` into the first of that month, else today's month. */
function resolveMonthStart(param: string | null, today: Date): Date {
  return startOfMonth((param && parseISOMonth(param)) || today)
}

/** Segmented List / Calendar switch for the feed. */
function ViewToggle({ view, onChange }: { view: FeedView; onChange: (next: FeedView) => void }) {
  return (
    <div
      role="group"
      aria-label="Feed layout"
      className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1"
    >
      {(['list', 'calendar'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={cx(
            'rounded-md px-2.5 py-1 text-sm font-medium transition',
            view === option ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
          )}
        >
          {option === 'list' ? 'List' : 'Calendar'}
        </button>
      ))}
    </div>
  )
}

/**
 * The gym a group belongs to: the gym's own colours, or the neutral chip used
 * for one-off names and "Not sure yet".
 */
function GymGroupHeading({ name }: { name: string }) {
  const palette = gymPaletteOf(name)

  return (
    <span
      className={cx(
        'inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-xs font-semibold',
        palette ? null : 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
      )}
      style={palette ? { backgroundColor: palette.fill, color: palette.text } : undefined}
    >
      {name}
    </span>
  )
}

/** One climber's session inside a gym group. */
function FeedSessionRow({ entry }: { entry: ClimbEntry }) {
  const name = displayNameOf(entry.climber)
  const handle = usernameOf(entry.climber)
  // The gym is the group header now, so only an "either" session needs its own
  // label — it is filed under two gyms at once.
  const showGymLabel = climbGymNames(entry).length > 1

  return (
    <Card className="flex items-start gap-3">
      <Avatar profile={entry.climber} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-medium text-zinc-100">{name}</p>
          {/* Skip the handle when it is already the name (no display name). */}
          {handle && handle !== name ? (
            <span className="text-xs text-zinc-500">{handle}</span>
          ) : null}
        </div>

        {showGymLabel ? <GymCell climb={entry} /> : null}

        <p className="text-xs font-medium text-emerald-300">
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
      </div>
    </Card>
  )
}

/** Sessions grouped per gym: heading, climber count, then the climber rows. */
function GymGroupList({ groups }: { groups: GymGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.gymName} role="group" aria-label={group.gymName}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <GymGroupHeading name={group.gymName} />
            <span className="text-xs text-zinc-500">
              {group.climberCount} climber{group.climberCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              // One session can sit in two groups, so the key is namespaced.
              <FeedSessionRow key={`${group.gymName}-${entry.id}`} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface CalendarCellProps {
  date: Date
  entries: ClimbEntry[]
  inMonth: boolean
  selected: boolean
  onSelect: (dateISO: string) => void
}

/** A day in the month grid: the date, plus one dot per climber heading out. */
function CalendarCell({ date, entries, inMonth, selected, onSelect }: CalendarCellProps) {
  const climbers = uniqueClimbers(entries)
  const shown = climbers.slice(0, CALENDAR_DOTS)
  const overflow = climbers.length - shown.length
  const today = isToday(date) && inMonth

  return (
    <button
      type="button"
      // Days borrowed from the neighbouring month have no data loaded.
      disabled={!inMonth}
      aria-pressed={selected}
      aria-label={`${formatMediumDate(date)}, ${
        climbers.length === 0 ? 'no sessions yet' : `${climbers.length} climbing`
      }`}
      onClick={() => onSelect(toISODate(date))}
      className={cx(
        'flex min-h-16 flex-col items-center gap-1 rounded-lg border p-1.5 transition sm:min-h-20',
        inMonth
          ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'
          : 'border-transparent opacity-40',
        today && !selected ? 'border-emerald-800/70' : null,
        selected ? 'border-emerald-600 ring-2 ring-emerald-900/50' : null,
      )}
    >
      <span
        className={cx(
          'text-xs font-semibold',
          today ? 'text-emerald-400' : inMonth ? 'text-zinc-300' : 'text-zinc-600',
        )}
      >
        {date.getDate()}
      </span>

      <span className="flex flex-wrap items-center justify-center gap-0.5">
        {shown.map((climber) => (
          <Avatar key={climber.id} profile={climber} size="xs" />
        ))}
        {overflow > 0 ? (
          <span className="text-[10px] font-medium text-zinc-400">+{overflow}</span>
        ) : null}
      </span>
    </button>
  )
}

/** Weekday header row above the month grid. */
function CalendarWeekdays() {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAY_NAMES_SHORT.map((day) => (
        <span key={day} className="text-center text-[11px] font-medium text-zinc-500">
          {day}
        </span>
      ))}
    </div>
  )
}

export default function Feed() {
  const { userId, profile } = useAuth()
  const { gyms } = useGyms()
  const [searchParams, setSearchParams] = useSearchParams()
  const [gymFilter, setGymFilter] = useState('')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Captured once, so "today" and the horizon do not drift while you browse.
  const today = useMemo(() => new Date(), [])
  const view: FeedView = searchParams.get('view') === 'calendar' ? 'calendar' : 'list'
  const monthStart = useMemo(
    () => resolveMonthStart(searchParams.get('month'), today),
    [searchParams, today],
  )

  // The two views look at different windows: the list scans ahead, the calendar
  // needs the whole month on screen.
  const startDate = view === 'calendar' ? toISODate(startOfMonth(monthStart)) : toISODate(today)
  const endDate =
    view === 'calendar'
      ? toISODate(endOfMonth(monthStart))
      : toISODate(addDays(today, FEED_HORIZON_DAYS))

  // participantIds = null: let RLS decide, then keep public profiles plus your
  // own rows — leaving your own sessions out made it look like they weren't
  // posted at all.
  const { entries, loading, error, reload } = useClimbs({ startDate, endDate, participantIds: null })

  // `''` is every gym. Matching happens on the name, so a session that typed the
  // gym name instead of picking it still filters — and an "either" session
  // matches on both of its slots.
  const selectedGymName = gymFilter ? gyms.find((gym) => gym.id === gymFilter)?.name : undefined

  const feedEntries = useMemo(() => {
    const visible = entries.filter(
      (entry) => entry.user_id === userId || entry.climber.visibility === 'public',
    )
    if (!selectedGymName) return visible
    return visible.filter((entry) => climbGymNames(entry).includes(selectedGymName))
  }, [entries, userId, selectedGymName])

  const dayGroups = useMemo(() => groupByDate(feedEntries), [feedEntries])
  const byDate = useMemo(() => indexByDate(feedEntries), [feedEntries])
  const calendarDays = useMemo(() => monthDays(monthStart), [monthStart])
  const gymGroups = groupGymsByRegion(gyms)

  // Filtering to one gym must not make an "either" session show up twice, so the
  // grouping is told which gym the reader asked for.
  const groupOptions = { onlyGymName: selectedGymName }
  const selectedEntries = selectedDay ? byDate.get(selectedDay) ?? [] : []
  const selectedGroups = groupByGym(selectedEntries, groupOptions)
  const selectedClimbers = uniqueClimbers(selectedEntries)
  const isCurrentMonth = isSameMonth(monthStart, today)

  const withParams = (changes: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams)
    changes(params)
    setSearchParams(params, { replace: true })
  }

  const setView = (next: FeedView) =>
    withParams((params) => {
      if (next === 'calendar') {
        params.set('view', 'calendar')
        params.set('month', toISOMonth(monthStart))
      } else {
        params.delete('view')
        params.delete('month')
      }
    })

  const goToMonth = (offset: number) => {
    const nextMonth = addMonths(monthStart, offset)
    // A day picked in another month would leave a stale list on screen.
    if (selectedDay && !isSameMonth(parseISODate(selectedDay), nextMonth)) setSelectedDay(null)

    withParams((params) => {
      params.set('view', 'calendar')
      params.set('month', toISOMonth(nextMonth))
    })
  }

  const goToThisMonth = () =>
    withParams((params) => {
      params.set('view', 'calendar')
      params.set('month', toISOMonth(today))
    })

  const toggleDay = (dateISO: string) =>
    setSelectedDay((current) => (current === dateISO ? null : dateISO))

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Climbers feed"
        hint={
          view === 'calendar'
            ? `Public profiles plus your own sessions, day by day in ${formatMonthLabel(monthStart)}.`
            : `Public profiles plus your own sessions, grouped by gym over the next ${FEED_HORIZON_DAYS} days.`
        }
        action={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <button type="button" onClick={reload} className={ghostButtonClass}>
              Refresh
            </button>
          </div>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      {profile?.visibility === 'private' ? (
        <p className="rounded-lg border border-sky-900/60 bg-sky-950/40 px-3 py-2 text-sm text-sky-200">
          Your profile is private, so only you can see your sessions here.{' '}
          <Link to="/settings" className="font-semibold underline">
            Switch to public
          </Link>{' '}
          if you want other climbers to find you.
        </p>
      ) : null}

      <div className="max-w-xs">
        <Field label="Filter by gym" htmlFor="feed-gym">
          <Select
            id="feed-gym"
            value={gymFilter}
            onChange={(event) => setGymFilter(event.target.value)}
          >
            <option value="">All gyms</option>
            {gymGroups.map((group) => (
              <optgroup key={group.region} label={group.region}>
                {group.gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      </div>

      {loading ? (
        <PageLoader label="Loading the feed…" />
      ) : view === 'list' ? (
        dayGroups.length === 0 ? (
          <EmptyState
            title={selectedGymName ? `Nobody at ${selectedGymName}` : 'Nothing on the horizon'}
            hint={
              selectedGymName
                ? `No sessions there in the next ${FEED_HORIZON_DAYS} days — try another gym.`
                : "Your sessions and public climbers' sessions show up here, grouped by gym."
            }
          />
        ) : (
          <div className="space-y-5">
            {dayGroups.map((group) => (
              <section key={group.date}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    {formatMediumDate(group.date)}
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {group.entries.length} session{group.entries.length === 1 ? '' : 's'}
                  </span>
                </div>
                <GymGroupList groups={groupByGym(group.entries, groupOptions)} />
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => goToMonth(-1)}
                aria-label="Previous month"
              >
                ←
              </button>
              <p className="min-w-40 text-center text-sm font-semibold text-zinc-100">
                {formatMonthLabel(monthStart)}
              </p>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => goToMonth(1)}
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={goToThisMonth}
              disabled={isCurrentMonth}
            >
              This month
            </button>
          </div>

          <CalendarWeekdays />

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day) => {
              const dateISO = toISODate(day)
              return (
                <CalendarCell
                  key={dateISO}
                  date={day}
                  entries={byDate.get(dateISO) ?? []}
                  // Days borrowed from the neighbouring month have no data.
                  inMonth={isSameMonth(day, monthStart)}
                  selected={selectedDay === dateISO}
                  onSelect={toggleDay}
                />
              )
            })}
          </div>

          {selectedDay ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">
                  {formatMediumDate(selectedDay)}
                </h3>
                <span className="text-xs text-zinc-500">
                  {selectedClimbers.length === 0
                    ? 'nothing posted'
                    : `${selectedClimbers.length} climbing at ${selectedGroups.length} gym${
                        selectedGroups.length === 1 ? '' : 's'
                      }`}
                </span>
              </div>

              {selectedGroups.length === 0 ? (
                <EmptyState
                  title={selectedGymName ? `Nobody at ${selectedGymName}` : 'Nobody yet'}
                  hint="No sessions posted for this day — pick another."
                />
              ) : (
                <GymGroupList groups={selectedGroups} />
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Tap a day to see who is climbing.</p>
          )}
        </div>
      )}
    </div>
  )
}
