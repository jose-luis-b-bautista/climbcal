/**
 * Stats — what your climbing looks like so far.
 *
 * Everything on this page comes from the read-only views in
 * `supabase/migrations/20260923000000_stats_views.sql`: headline cards from
 * `climber_totals`, the daily heatmap from `climber_daily_activity`, and the
 * "where I climb" breakdown from `climber_gym_stats`. The views are
 * `security_invoker`, so RLS decides the scope — which is why the climber picker
 * offers yourself plus your accepted friends and nothing else.
 *
 * A session here is a *plan you posted*, not a logged send: the schema has no
 * grades, so the honest numbers are frequency, timing and place. Durations count
 * only windows whose ends are both clock times (`is_exact_window`); a slot-only
 * plan ("Opening" – "Closing") has a notional length and is never shown as time
 * on the wall.
 */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { DAY_NAMES_SHORT, formatMediumDate, formatMinutesSpan, formatShortDate } from '../lib/date'
import { displayNameOf, usernameOf } from '../lib/format'
import {
  HEAT_LEVEL_CLASSES,
  HEAT_PLANNED_CLASS,
  HEATMAP_WEEKS,
  activityByDate,
  buildHeatmap,
  gymShare,
  heatLevel,
  heatmapStartDate,
  rankGymStats,
  type HeatmapWeek,
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

/** Tooltip/label for one day: "Sep 16: 2 sessions, 1h" or "… (planned)". */
function dayLabel(week: HeatmapWeek, index: number): string {
  const day = week.days[index]
  const count =
    day.sessions === 0 ? 'no sessions' : `${day.sessions} session${day.sessions === 1 ? '' : 's'}`
  const minutes = day.exactMinutes > 0 ? `, ${formatMinutesSpan(day.exactMinutes)}` : ''
  return `${formatMediumDate(day.date)}: ${count}${minutes}${day.planned ? ' (planned)' : ''}`
}

/**
 * Half a year of days as Monday-first columns. A future day is drawn as an
 * outline: a climb row is a plan, so next week's sessions are real data and must
 * not read as "nothing yet".
 */
function Heatmap({ weeks }: { weeks: HeatmapWeek[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1.5">
        <div aria-hidden="true" className="flex flex-col gap-0.5 pr-1 text-[10px] text-zinc-500">
          {DAY_NAMES_SHORT.map((name, index) => (
            <span key={name} className="h-3 leading-3">
              {index % 2 === 0 ? name : ''}
            </span>
          ))}
        </div>

        <div role="group" aria-label="Daily activity" className="flex gap-0.5">
          {weeks.map((week) => (
            <div key={week.weekStart} className="flex flex-col gap-0.5">
              {week.days.map((day, index) => (
                <span
                  key={day.date}
                  role="img"
                  aria-label={dayLabel(week, index)}
                  title={dayLabel(week, index)}
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

/** "Where I climb": one bar per gym, most sessions first, unnamed bucket last. */
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
              {row.days === 1 ? '' : 's'}
              {row.exact_minutes > 0 ? ` · ${formatMinutesSpan(row.exact_minutes)}` : ''}
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

  // `?climber=<id>` keeps a friend's stats linkable, like the feed's filters — but
  // only for a climber we already know about, so a stale id falls back to you.
  const param = searchParams.get('climber')
  const requested = param && (param === userId || friendIds.includes(param)) ? param : null
  const targetId = requested ?? userId ?? null
  const isSelf = targetId === userId

  const { totals, activity, gymStats, loading, error, missingViews, reload } = useClimberStats({
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
  const gymRows = useMemo(
    () => gymStats.filter((row) => row.user_id === targetId),
    [gymStats, targetId],
  )

  const weeks = useMemo(
    () => buildHeatmap(today, activityByDate(activityRows), HEATMAP_WEEKS),
    [today, activityRows],
  )
  const rankedGyms = useMemo(() => rankGymStats(gymRows), [gymRows])

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
        hint={
          isSelf
            ? 'Your climbing so far — every session you have posted.'
            : `The sessions ${who} has posted that you can see.`
        }
        action={
          <div className="flex items-end gap-2">
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
            <button type="button" className={ghostButtonClass} onClick={reload}>
              Refresh
            </button>
          </div>
        }
      />

      {missingViews ? (
        <Notice>
          The stats views are not in the database yet. Run{' '}
          <code>supabase/migrations/{STATS_MIGRATION}</code> — with the CLI that is{' '}
          <code>npx supabase@latest db push</code> — then refresh.
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
              hint={`over ${totalRow.active_weeks} week${totalRow.active_weeks === 1 ? '' : 's'}`}
            />
            <StatCard
              label="On the wall"
              value={formatMinutesSpan(totalRow.exact_minutes)}
              hint="clock-time sessions only"
            />
            <StatCard
              label="Usual session"
              value={totalRow.avg_exact_minutes ? formatMinutesSpan(totalRow.avg_exact_minutes) : '—'}
              hint="average, exact windows"
            />
            <StatCard
              label="Gyms"
              value={`${totalRow.gyms_visited}`}
              hint={`${totalRow.regions_visited} region${totalRow.regions_visited === 1 ? '' : 's'}`}
            />
            <StatCard label="Notes written" value={`${totalRow.sessions_with_note}`} />
          </div>

          <Card>
            <SectionHeading
              title="Activity"
              hint={`Last ${HEATMAP_WEEKS} weeks, ${formatShortDate(sinceDate)} – ${formatShortDate(
                today,
              )}.`}
            />
            <Heatmap weeks={weeks} />
            <HeatmapLegend />
            <p className="mt-3 text-xs text-zinc-500">
              Each cell is a day: shaded means you posted a session, dashed means the day has not
              happened yet — a plan already posted for one still counts, and its label says how many
              sessions.
            </p>
          </Card>

          <Card>
            <SectionHeading
              title="Where I climb"
              hint="Sessions per gym, including sessions that offered two."
            />
            {rankedGyms.length === 0 ? (
              <EmptyState title="No gyms yet" hint="Name a gym on a session to see this fill in." />
            ) : (
              <GymBreakdown rows={rankedGyms} />
            )}
            <p className="mt-3 text-xs text-zinc-500">
              A session that offered two gyms counts under both, so the bars can add up to more than
              your session total. Minutes count only the sessions with exact clock times.
            </p>
          </Card>

          {totalRow.first_session && totalRow.last_session ? (
            <p className="text-xs text-zinc-500">
              First session {formatMediumDate(totalRow.first_session)}, most recent{' '}
              {formatMediumDate(totalRow.last_session)}.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
