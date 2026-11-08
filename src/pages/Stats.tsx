/**
 * Stats - what your climbing looks like so far.
 *
 * Everything on this page comes from the read-only views in
 * `supabase/migrations/20260923000000_stats_views.sql`: headline cards from
 * `climber_totals`, the daily heatmap from `climber_daily_activity` (with the gym
 * names behind each day from `climb_gyms`, for the hover label), and the
 * "where I climb" breakdown from `climber_gym_stats`. The views are
 * `security_invoker`, so RLS decides the scope - which is why the climber picker
 * offers yourself plus your accepted friends and nothing else.
 *
 * A session here is a *plan you posted*, not a logged send: the schema has no
 * grades, and a climb row is a day on the calendar rather than a stopwatch, so
 * this page counts **days, sessions and places** - never hours. Durations exist in
 * the views (`exact_minutes`, exact clock windows only) for other surfaces; here
 * they would only invite comparing training loads the data cannot support.
 */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  GymNameChip,
  Notice,
  PageLoader,
  SectionHeading,
  Select,
  cx,
  ghostButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useClimberStats } from '../hooks/useClimberStats'
import { useFriends } from '../hooks/useFriends'
import {
  DAY_NAMES,
  DAY_NAMES_SHORT,
  formatMediumDate,
  formatShortDate,
} from '../lib/date'
import { displayNameOf, usernameOf } from '../lib/format'
import { climberWallPath } from '../lib/routes'
import {
  HEAT_LEVEL_CLASSES,
  HEAT_PLANNED_CLASS,
  HEATMAP_WEEKS,
  activityByDate,
  buildHeatmap,
  favouriteWeekday,
  groupHeatmapByMonth,
  gymShare,
  gymsByDate,
  heatLevel,
  heatmapStartDate,
  nextPlannedDay,
  rankGymStats,
  sessionsByRegion,
  weekStreak,
  type HeatmapDay,
  type HeatmapMonth,
} from '../lib/stats'

/** The migration a stats page needs before its views exist. */
const STATS_MIGRATION = '20260923000000_stats_views.sql'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  )
}

/**
 * Tooltip/label for one day: "Sep 16: 2 sessions · BHive" or "… (planned)".
 * The gyms come from `climb_gyms`, so hovering a square answers *where* the day
 * was spent - and no duration: this grid is about the day, not the hours in it.
 */
function dayLabel(day: HeatmapDay): string {
  const count =
    day.sessions === 0 ? 'no sessions' : `${day.sessions} session${day.sessions === 1 ? '' : 's'}`
  const gyms = day.gyms.length > 0 ? ` · ${day.gyms.join(', ')}` : ''
  return `${formatMediumDate(day.date)}: ${count}${gyms}${day.planned ? ' (planned)' : ''}`
}

/**
 * 13 weeks of days (a quarter of a year) as Monday-first columns, split into
 * month blocks so the grid can be read a month at a time. A future day is drawn
 * as an outline: a climb row is a plan, so next week's sessions are real data and
 * must not read as "nothing yet".
 *
 * A block carries its own month header, and the flex gap between blocks is the
 * visual break between months - no dividers, which would compete with the cells.
 * The weekday column gets a matching spacer so its labels stay on the squares.
 */
function Heatmap({ months }: { months: HeatmapMonth[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1.5">
        <div aria-hidden="true" className="flex flex-col gap-1 pr-1 text-[10px] text-zinc-500">
          {/* Sits beside the month headers, so the day labels line up with cells. */}
          <span className="h-3 leading-3" />
          <div className="flex flex-col gap-0.5">
            {DAY_NAMES_SHORT.map((name, index) => (
              <span key={name} className="h-3 leading-3">
                {index % 2 === 0 ? name : ''}
              </span>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Daily activity" className="flex gap-3">
          {months.map((month) => (
            <div key={month.month} className="flex flex-col gap-1">
              <span className="h-3 text-[10px] leading-3 text-zinc-500">{month.label}</span>
              <div className="flex gap-0.5">
                {month.weeks.map((week) => (
                  <div key={week.weekStart} className="flex flex-col gap-0.5">
                    {week.days.map((day) => (
                      <span
                        key={day.date}
                        role="img"
                        aria-label={dayLabel(day)}
                        title={dayLabel(day)}
                        className={cx(
                          'h-3 w-3 rounded-sm',
                          day.planned
                            ? HEAT_PLANNED_CLASS
                            : HEAT_LEVEL_CLASSES[heatLevel(day.sessions)],
                        )}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HeatmapLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
      <span className="flex items-center gap-1">
        <span className={cx('h-3 w-3 rounded-sm', HEAT_LEVEL_CLASSES[0])} />
        no session
      </span>
      <span className="flex items-center gap-1">
        <span className={cx('h-3 w-3 rounded-sm', HEAT_LEVEL_CLASSES[1])} />
        climbed
      </span>
      <span className="flex items-center gap-1">
        <span className={cx('h-3 w-3 rounded-sm', HEAT_PLANNED_CLASS)} />
        planned
      </span>
    </div>
  )
}

/**
 * Where the sessions happen, in one line: the per-gym bars answer "which gym",
 * this answers "how far do I travel". Hidden when everything is in one region -
 * the Gyms card already says so.
 */
function RegionSplit({ regions }: { regions: ReturnType<typeof sessionsByRegion> }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
      <span className="tracking-wide text-zinc-500 uppercase">By region</span>
      {regions.map((row) => (
        <span key={row.region} className="flex items-center gap-1.5">
          {row.region}
          <span className="rounded-md bg-zinc-800/70 px-1.5 py-0.5 font-semibold text-zinc-200">
            {row.sessions}
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * "Where I climb": one bar per gym, most sessions first, unnamed bucket last.
 * The trailing "last …" is the nudge - a gym you have not been to in two months is
 * the interesting row, not the busiest one.
 */
function GymBreakdown({ rows }: { rows: ReturnType<typeof rankGymStats> }) {
  // The unnamed bucket can be the biggest, so the scale takes the maximum across
  // every row rather than the first (which ranking puts first among *named* gyms).
  const busiest = rows.reduce((max, row) => Math.max(max, row.sessions), 0)

  return (
    <ul aria-label="Where I climb" className="space-y-2">
      {rows.map((row) => (
        <li key={`${row.gym_name}-${row.region}`} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-2">
              {row.is_named_gym ? (
                <GymNameChip name={row.gym_name} />
              ) : (
                <span className="rounded-md border border-dashed border-zinc-700 px-1.5 py-0.5 text-xs font-semibold text-zinc-400">
                  {row.gym_name}
                </span>
              )}
              <span className="text-xs text-zinc-500">{row.region}</span>
            </span>
            <span className="text-xs text-zinc-400">
              {row.sessions} session{row.sessions === 1 ? '' : 's'} · {row.days} day
              {row.days === 1 ? '' : 's'} · last {formatShortDate(row.last_visit)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800">
            <div
              className={cx(
                'h-full rounded-full',
                row.is_named_gym ? 'bg-emerald-600' : 'bg-zinc-600',
              )}
              style={{ width: `${gymShare(row.sessions, busiest)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Stats() {
  const { userId, profile } = useAuth()
  const { friends, friendIds } = useFriends()
  const [searchParams, setSearchParams] = useSearchParams()

  // "Today" is captured once per mount so the heatmap window and the planned days
  // agree with the range the query asked for.
  const today = useMemo(() => new Date(), [])
  const sinceDate = useMemo(() => heatmapStartDate(today), [today])

  // `?climber=<id>` keeps a friend's stats linkable, like the feed's filters - but
  // only for a climber we already know about, so a stale id falls back to you.
  const param = searchParams.get('climber')
  const requested = param && (param === userId || friendIds.includes(param)) ? param : null
  const targetId = requested ?? userId ?? null
  const isSelf = targetId === userId

  const { totals, activity, climbGyms, gymStats, loading, error, missingViews, reload } =
    useClimberStats({
      userId: targetId,
      sinceDate,
      enabled: Boolean(targetId),
    })

  // Only ever render rows that belong to the climber on screen: switching in the
  // picker re-queries, and the previous climber's numbers must not sit under the
  // new heading while that is in flight.
  const totalRow = totals && totals.user_id === targetId ? totals : null
  const activityRows = useMemo(
    () => activity.filter((row) => row.user_id === targetId),
    [activity, targetId],
  )
  const gymNameRows = useMemo(
    () => climbGyms.filter((row) => row.user_id === targetId),
    [climbGyms, targetId],
  )
  const gymRows = useMemo(
    () => gymStats.filter((row) => row.user_id === targetId),
    [gymStats, targetId],
  )

  const weeks = useMemo(
    () =>
      buildHeatmap(today, activityByDate(activityRows), HEATMAP_WEEKS, gymsByDate(gymNameRows)),
    [today, activityRows, gymNameRows],
  )
  const months = useMemo(() => groupHeatmapByMonth(weeks), [weeks])

  // The rhythm cards all read the same 13 weeks the grid draws, so the numbers and
  // the squares can never disagree.
  const streak = useMemo(() => weekStreak(weeks), [weeks])
  const weekday = useMemo(() => favouriteWeekday(weeks), [weeks])
  const nextDay = useMemo(() => nextPlannedDay(weeks), [weeks])
  const regions = useMemo(() => sessionsByRegion(gymRows), [gymRows])
  const rankedGyms = useMemo(() => rankGymStats(gymRows), [gymRows])

  /** One line under the cards: how far back this goes, and what is next. */
  const rangeLine = useMemo(() => {
    if (!totalRow) return ''

    const parts: string[] = []
    if (totalRow.first_session && totalRow.last_session) {
      parts.push(
        `First session ${formatMediumDate(totalRow.first_session)}, most recent ${formatMediumDate(
          totalRow.last_session,
        )}.`,
      )
    }
    if (nextDay) {
      const where = nextDay.gyms.length > 0 ? ` at ${nextDay.gyms.join(' or ')}` : ''
      parts.push(`Next ${formatMediumDate(nextDay.date)}${where}.`)
    }

    return parts.join(' ')
  }, [totalRow, nextDay])

  const selectClimber = (id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('climber', id)
    setSearchParams(next, { replace: true })
  }

  const selected = isSelf ? profile : friends.find((friend) => friend.id === targetId)
  const who = isSelf ? 'you' : displayNameOf(selected)

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Stats"
        action={
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40">
              <Field label="Climber" htmlFor="stats-climber">
                <Select
                  id="stats-climber"
                  value={targetId ?? ''}
                  onChange={(event) => selectClimber(event.target.value)}
                >
                  <option value={userId ?? ''}>
                    {`You${profile ? ` (${usernameOf(profile) ?? displayNameOf(profile)})` : ''}`}
                  </option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={friend.id}>
                      {`${displayNameOf(friend)}${
                        usernameOf(friend) ? ` (${usernameOf(friend)})` : ''
                      }`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {targetId ? (
              <Link to={climberWallPath(targetId)} className={ghostButtonClass}>
                Wall
              </Link>
            ) : null}
            <button type="button" className={ghostButtonClass} onClick={reload}>
              Refresh
            </button>
          </div>
        }
      />

      {missingViews ? (
        <Notice>
          The stats views are not in the database yet. Run{' '}
          <code>supabase/migrations/{STATS_MIGRATION}</code> - with the CLI that is{' '}
          <code>npx supabase@latest db push --include-all --remote</code> - then refresh.
        </Notice>
      ) : null}

      {error && !missingViews ? <ErrorBanner message={error} /> : null}

      {loading && !totalRow ? (
        <PageLoader label="Counting sessions…" />
      ) : !totalRow || totalRow.sessions === 0 ? (
        <EmptyState
          title={isSelf ? 'No sessions yet' : `${who} has no visible sessions`}
          hint={
            isSelf
              ? 'Add a session on the Week page and your stats will fill in from here.'
              : 'Sessions show up here once they post one you are allowed to see.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Sessions"
              value={`${totalRow.sessions_past}`}
              hint={
                totalRow.sessions_upcoming > 0
                  ? `+${totalRow.sessions_upcoming} planned`
                  : 'posted and done'
              }
            />
            <StatCard
              label="Active days"
              value={`${totalRow.active_days}`}
              hint={`over ${totalRow.active_weeks} week${
                totalRow.active_weeks === 1 ? '' : 's'
              }, ${totalRow.active_months} month${totalRow.active_months === 1 ? '' : 's'}`}
            />
            {/* Weeks, not days, and not hours: a climb row is a day on the calendar. */}
            <StatCard
              label="Week streak"
              value={`${streak.current} week${streak.current === 1 ? '' : 's'}`}
              hint={`best ${streak.best} in ${HEATMAP_WEEKS}`}
            />
            <StatCard
              label="Usual day"
              value={weekday.isoDow ? DAY_NAMES[weekday.isoDow - 1] : '-'}
              hint={
                weekday.isoDow
                  ? `${weekday.sessions} of ${weekday.total} session${
                      weekday.total === 1 ? '' : 's'
                    }`
                  : 'nothing climbed yet'
              }
            />
            <StatCard
              label="Gyms"
              value={`${totalRow.gyms_visited}`}
              hint={`${totalRow.regions_visited} region${totalRow.regions_visited === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Notes written"
              value={`${totalRow.sessions_with_note}`}
              hint={
                totalRow.sessions_with_note > 0 ? `of ${totalRow.sessions} sessions` : undefined
              }
            />
          </div>

          <Card>
            <SectionHeading
              title="Activity"
              hint={`Last ${HEATMAP_WEEKS} weeks, ${formatShortDate(sinceDate)} – ${formatShortDate(
                today,
              )}.`}
            />
            <Heatmap months={months} />
            <HeatmapLegend />
          </Card>

          <Card>
            <SectionHeading
              title="Where I climb"
              hint="Sessions per gym, including sessions that offered two."
            />
            {rankedGyms.length === 0 ? (
              <EmptyState title="No gyms yet" hint="Name a gym on a session to see this fill in." />
            ) : (
              <>
                {regions.length > 1 ? <RegionSplit regions={regions} /> : null}
                <GymBreakdown rows={rankedGyms} />
              </>
            )}
          </Card>

          {rangeLine ? <p className="text-xs text-zinc-500">{rangeLine}</p> : null}
        </>
      )}
    </div>
  )
}
