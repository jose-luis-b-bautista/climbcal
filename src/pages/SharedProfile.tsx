/**
 * The public share page — `/u/<username>`.
 *
 * This is the one surface reachable **without a session** (see `App.tsx`): the
 * whole point of a share link is that someone who has not signed up can open it,
 * so it sits outside `RequireAuth` / `RequireProfile` and brings its own light
 * header instead of the app shell.
 *
 * What it shows is deliberately narrow. The data comes from
 * `public.shared_profile` (see
 * `supabase/migrations/20260924000000_public_profile_share.sql`), which answers
 * only for a profile whose owner chose `visibility = 'public'` and leaves session
 * **notes** out: a shared week is "who is climbing, where, and when". A private
 * profile and an unknown username both read as "not shared", so the page cannot
 * be used to find out whether an account exists.
 *
 * Signed-in visitors are welcome too: the same link keeps working, and the call
 * to action switches from "create an account" to "add them as a friend".
 */
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SessionCard } from '../components/SessionCard'
import { ShareLink } from '../components/ShareLink'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  Notice,
  PageLoader,
  SectionHeading,
  VisibilityBadge,
  cx,
  ghostButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSharedProfile } from '../hooks/useSharedProfile'
import {
  DAY_NAMES_SHORT,
  addWeeks,
  formatShortDate,
  formatWeekRange,
  isToday,
  resolveWeekStart,
  startOfWeek,
  toISODate,
  weekDays,
} from '../lib/date'
import { displayNameOf, usernameOf } from '../lib/format'
import { indexByDate } from '../lib/group'
import { profileSharePath } from '../lib/routes'

/** Header + spacing for the public page, which renders outside the app shell. */
function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-5 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            🧗
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">climbcal</span>
        </span>
        <ThemeToggle />
      </header>
      <main className="space-y-6">{children}</main>
    </div>
  )
}

/** The "create an account" / "sign in" pair, kept in one place on purpose. */
function JoinActions({ loginHref }: { loginHref: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={loginHref} className={primaryButtonClass}>
        Create a free account
      </Link>
      <Link to={loginHref} className={secondaryButtonClass}>
        Sign in
      </Link>
    </div>
  )
}

export default function SharedProfile() {
  const { username } = useParams<{ username: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile: ownProfile, loading: authLoading, profileLoading } = useAuth()

  // The visitor's own Monday, so the week they see matches the app's idea of it.
  const weekStart = useMemo(() => resolveWeekStart(searchParams.get('week')), [searchParams])
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const weekStartISO = toISODate(weekStart)

  const { profile, entries, loading, notFound, error } = useSharedProfile(username, weekStartISO)
  const byDate = useMemo(() => indexByDate(entries), [entries])

  const sharePath = username ? profileSharePath(username) : '/'
  // Where the auth flow should return to once they have an account.
  const loginHref = `/login?next=${encodeURIComponent(sharePath)}`
  const isOwner = Boolean(profile && ownProfile && ownProfile.id === profile.id)

  const goToWeek = (next: Date) => setSearchParams({ week: toISODate(next) })

  // Waiting for the session *and* the visitor's own profile row, so a signed-in
  // visitor never sees the "create an account" card flash before the page
  // settles. `profileLoading` is only ever true when there is a session, so a
  // signed-out visitor waits for nothing extra.
  if (authLoading || profileLoading || loading) {
    return (
      <PublicShell>
        <PageLoader label="Loading the shared week…" />
      </PublicShell>
    )
  }

  if (error) {
    return (
      <PublicShell>
        <Card>
          <SectionHeading
            title="Could not load that profile"
            hint="The shared week is read from Supabase, so a network problem shows up here."
          />
          <ErrorBanner message={error} />
          <div className="mt-4">
            <JoinActions loginHref={loginHref} />
          </div>
        </Card>
      </PublicShell>
    )
  }

  if (notFound || !profile) {
    return (
      <PublicShell>
        <Card>
          <SectionHeading
            title="This profile isn’t shared"
            hint="The link may be out of date, or that climber keeps their week private."
          />
          <p className="text-sm text-zinc-400">
            Only climbers who set their profile to <strong>Public</strong> can be shared with a
            link — a private week is visible to accepted friends only.
          </p>
          <div className="mt-4">
            <JoinActions loginHref={loginHref} />
          </div>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <Card>
        <div className="flex items-center gap-3">
          <Avatar profile={profile} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-zinc-100">
              {displayNameOf(profile)}
            </h1>
            {usernameOf(profile) ? (
              <p className="text-sm text-zinc-400">{usernameOf(profile)}</p>
            ) : null}
          </div>
          <VisibilityBadge visibility={profile.visibility} />
        </div>

        {isOwner ? (
          <div className="mt-4">
            <ShareLink path={sharePath} />
          </div>
        ) : null}
      </Card>

      {isOwner ? (
        <Notice>
          You are looking at your public page — this is what anyone with the link sees.
        </Notice>
      ) : null}

      <Card>
        <SectionHeading
          title={isOwner ? 'Your shared week' : 'Their week'}
          hint={formatWeekRange(weekStart)}
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => goToWeek(addWeeks(weekStart, -1))}
              >
                ‹ Prev
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => goToWeek(startOfWeek(new Date()))}
              >
                This week
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => goToWeek(addWeeks(weekStart, 1))}
              >
                Next ›
              </button>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day, index) => {
            const dateISO = toISODate(day)
            const dayEntries = byDate.get(dateISO) ?? []

            return (
              <div
                key={dateISO}
                className={cx(
                  'rounded-xl border p-3',
                  isToday(day)
                    ? 'border-emerald-800/70 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/30',
                )}
              >
                <p className="mb-2 text-sm font-semibold text-zinc-100">
                  {DAY_NAMES_SHORT[index]}{' '}
                  <span className="font-normal text-zinc-500">{formatShortDate(day)}</span>
                </p>

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
                        isOwn={false}
                        onEdit={() => undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {entries.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing planned this week"
              hint="Try another week, or start your own climbing calendar."
            />
          </div>
        ) : null}
      </Card>

      {isOwner ? null : ownProfile ? (
        <Card>
          <SectionHeading
            title="Climb with them?"
            hint="Add them as a friend to see their full schedule alongside yours."
          />
          <Link to="/friends" className={secondaryButtonClass}>
            Go to Friends
          </Link>
        </Card>
      ) : (
        <Card>
          <SectionHeading
            title="Climb with them?"
            hint="climbcal is where a climbing group posts who is going, where, and when."
          />
          <JoinActions loginHref={loginHref} />
          <p className="mt-3 text-xs text-zinc-500">
            A shared link shows the time and the gym only — never session notes.
          </p>
        </Card>
      )}
    </PublicShell>
  )
}

