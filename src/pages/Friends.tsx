import { useRef, useMemo, useState, type ReactNode } from 'react'
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  PageLoader,
  SectionHeading,
  VisibilityBadge,
  dangerButtonClass,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { usePublicClimbers } from '../hooks/usePublicClimbers'
import { displayNameOf } from '../lib/format'
import type { Profile } from '../types'

function FriendRow({ profile, action }: { profile: Profile; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar profile={profile} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{displayNameOf(profile)}</p>
          <p className="truncate text-xs text-zinc-500">
            {profile.username ? `@${profile.username}` : 'no username yet'}
          </p>
        </div>
        <VisibilityBadge visibility={profile.visibility} />
      </div>
      <div className="flex shrink-0 items-center gap-2">{action}</div>
    </div>
  )
}

export default function Friends() {
  const { userId } = useAuth()
  const {
    friends,
    incoming,
    outgoing,
    profiles,
    loading,
    error,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    searchProfiles,
    relationFor,
  } = useFriends()

  const [term, setTerm] = useState('')
  // Mirrors `term` so a search that lands *after* the box was cleared cannot put
  // stale climbers back under an empty field.
  const latestTerm = useRef('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const profileFor = (id: string) => profiles[id]

  // What the empty search box offers: public climbers, newest first, minus the
  // ones there is already a friendship or request row for.
  const { climbers: publicClimbers, loading: climbersLoading } = usePublicClimbers()
  const suggestions = useMemo(
    () => publicClimbers.filter((profile) => !relationFor(profile.id)),
    [publicClimbers, relationFor],
  )

  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error ? actionFailure.message : 'Something went wrong.',
      )
    }
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    setSearchError(null)
    setSearching(true)
    setSearched(true)
    try {
      const found = await searchProfiles(term)
      // Ignore a result for a search whose term has since been cleared.
      if (latestTerm.current.trim() !== '') setResults(found)
    } catch (searchFailure) {
      setSearchError(searchFailure instanceof Error ? searchFailure.message : 'Search failed.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  /**
   * The search field is `type="search"`, so the browser's own clear (×) just
   * empties the input. Drop the previous results with it, otherwise stale
   * climbers stay listed under an empty box.
   */
  const handleTermChange = (value: string) => {
    latestTerm.current = value
    setTerm(value)
    if (value.trim() === '') {
      setResults([])
      setSearched(false)
      setSearchError(null)
    }
  }

  /** One row of either list; the action follows the existing relationship. */
  const renderClimberRow = (profile: Profile) => {
    const relation = relationFor(profile.id)
    const isSelf = profile.id === userId

    return (
      <FriendRow
        key={profile.id}
        profile={profile}
        action={
          isSelf ? (
            <span className="text-xs text-zinc-500">That's you</span>
          ) : !relation ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void run(() => sendRequest(profile.id))}
            >
              Add friend
            </button>
          ) : relation.status === 'accepted' ? (
            <span className="text-xs font-medium text-emerald-400">Friends ✓</span>
          ) : relation.requester_id === userId ? (
            // No cancel here: a pending request is withdrawn from the
            // "Sent requests" card below.
            <span className="text-xs text-zinc-500">Request sent</span>
          ) : (
            <>
              <span className="text-xs text-zinc-500">Asked you</span>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => void run(() => acceptRequest(relation.id))}
              >
                Accept
              </button>
            </>
          )
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Friends"
        hint="Search by username, accept requests, and manage who sees your week."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? (
        <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {loading ? (
        <PageLoader label="Loading your friends…" />
      ) : (
        <>
          <Card>
            <SectionHeading
              title="Requests"
              hint={
                incoming.length === 0
                  ? 'No pending incoming requests.'
                  : `${incoming.length} waiting on you.`
              }
            />
            {incoming.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing to accept right now.</p>
            ) : (
              incoming.map((request) => {
                const profile = profileFor(request.requester_id)
                if (!profile) return null
                return (
                  <FriendRow
                    key={request.id}
                    profile={profile}
                    action={
                      <>
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => void run(() => acceptRequest(request.id))}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => void run(() => declineRequest(request.id))}
                        >
                          Decline
                        </button>
                      </>
                    }
                  />
                )
              })
            )}
          </Card>

          <Card>
            <SectionHeading
              title="Your climbers"
              hint={
                friends.length === 0
                  ? 'No friends yet — search below to add someone.'
                  : `${friends.length} friend${friends.length === 1 ? '' : 's'}.`
              }
            />
            {friends.length === 0 ? (
              <EmptyState title="No friends yet" hint="Use the search below to send a request." />
            ) : (
              friends.map((friend) => {
                const relation = relationFor(friend.id)
                return (
                  <FriendRow
                    key={friend.id}
                    profile={friend}
                    action={
                      relation ? (
                        <button
                          type="button"
                          className={dangerButtonClass}
                          onClick={() => void run(() => removeFriend(relation.id))}
                        >
                          Unfriend
                        </button>
                      ) : null
                    }
                  />
                )
              })
            )}
          </Card>
        </>
      )}

      <Card>
        <SectionHeading
          title="Find climbers"
          hint="Search by username (at least 2 characters), or add someone from the list."
        />

        <form onSubmit={handleSearch} className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={term}
            onChange={(event) => handleTermChange(event.target.value)}
            placeholder="@username"
            className={`${inputClass} max-w-xs flex-1`}
            aria-label="Search climbers by username"
          />
          <button type="submit" className={primaryButtonClass} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError ? <ErrorBanner message={searchError} /> : null}

        {searched ? (
          <>
            {results.length === 0 && !searching ? (
              <p className="text-sm text-zinc-500">No climbers matched that username.</p>
            ) : null}
            {results.map(renderClimberRow)}
          </>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Newest climbers to add
            </p>
            {loading || climbersLoading ? (
              <p className="text-sm text-zinc-500">Loading climbers…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-zinc-500">No public climbers to add right now.</p>
            ) : (
              suggestions.map(renderClimberRow)
            )}
          </>
        )}
      </Card>

      {outgoing.length > 0 ? (
        <Card>
          <SectionHeading title="Sent requests" hint="Waiting for them to accept." />
          {outgoing.map((request) => {
            const profile = profileFor(request.addressee_id)
            if (!profile) return null
            return (
              <FriendRow
                key={request.id}
                profile={profile}
                action={
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => void run(() => declineRequest(request.id))}
                  >
                    Cancel
                  </button>
                }
              />
            )
          })}
        </Card>
      ) : null}
    </div>
  )
}
