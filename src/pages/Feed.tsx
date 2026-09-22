import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  PageLoader,
  SectionHeading,
  Select,
  ghostButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useGyms } from '../hooks/useGyms'
import { groupByDate, useClimbs } from '../hooks/useWeekClimbs'
import { addDays, formatDuration, formatMediumDate, formatTimeWindow, toISODate } from '../lib/date'
import { climbGymNames, displayNameOf, groupGymsByRegion, gymNameOf, usernameOf } from '../lib/format'

/** Days ahead included in the feed. */
const FEED_HORIZON_DAYS = 20

export default function Feed() {
  const { userId, profile } = useAuth()
  const { gyms } = useGyms()
  const [gymFilter, setGymFilter] = useState('')

  const startDate = toISODate(new Date())
  const endDate = toISODate(addDays(new Date(), FEED_HORIZON_DAYS))

  // participantIds = null: let RLS decide, then keep public profiles plus your
  // own rows — leaving your own sessions out made it look like they weren't
  // posted at all.
  const { entries, loading, error, reload } = useClimbs({
    startDate,
    endDate,
    participantIds: null,
  })

  // `''` is every gym. Matching happens on the name, so a session that typed the
  // gym name instead of picking it still filters — and an "either" session
  // matches on both of its slots.
  const selectedGymName = gymFilter
    ? gyms.find((gym) => gym.id === gymFilter)?.name
    : undefined

  const feedEntries = useMemo(() => {
    const visible = entries.filter(
      (entry) => entry.user_id === userId || entry.climber.visibility === 'public',
    )
    if (!selectedGymName) return visible
    return visible.filter((entry) => climbGymNames(entry).includes(selectedGymName))
  }, [entries, userId, selectedGymName])

  const groups = useMemo(() => groupByDate(feedEntries), [feedEntries])
  const gymGroups = groupGymsByRegion(gyms)

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Climbers feed"
        hint={`Public profiles plus your own sessions, over the next ${FEED_HORIZON_DAYS} days.`}
        action={
          <button type="button" onClick={reload} className={ghostButtonClass}>
            Refresh
          </button>
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
      ) : groups.length === 0 ? (
        <EmptyState
          title={selectedGymName ? `Nobody at ${selectedGymName}` : 'Nothing on the horizon'}
          hint={
            selectedGymName
              ? `No sessions there in the next ${FEED_HORIZON_DAYS} days — try another gym.`
              : "Your sessions and public climbers' sessions show up here, grouped by day."
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">
                  {formatMediumDate(group.date)}
                </h3>
                <span className="text-xs text-zinc-500">
                  {group.entries.length} session{group.entries.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {group.entries.map((entry) => {
                  const name = displayNameOf(entry.climber)
                  const handle = usernameOf(entry.climber)

                  return (
                    <Card key={entry.id} className="flex items-start gap-3">
                      <Avatar profile={entry.climber} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-sm font-medium text-zinc-100">{name}</p>
                          {/* Skip the handle when it is already the name (no display name). */}
                          {handle && handle !== name ? (
                            <span className="text-xs text-zinc-500">{handle}</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-zinc-300">{gymNameOf(entry)}</p>
                        <p className="text-xs font-medium text-emerald-300">
                          {formatTimeWindow(
                            entry.start_time,
                            entry.end_time,
                            entry.start_slot,
                            entry.end_slot,
                          )}
                          {/* A duration only makes sense when both ends are clock times. */}
                          {entry.start_time && entry.end_time ? (
                            <span className="text-zinc-500">
                              {' '}
                              · {formatDuration(entry.start_time, entry.end_time)}
                            </span>
                          ) : null}
                        </p>
                        {entry.note ? (
                          <p className="mt-1 text-xs text-zinc-400">{entry.note}</p>
                        ) : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
