/**
 * A climber's wall (guestbook) - `/wall/<userId>`.
 *
 * The second home of a comment thread: session comments live on the card, notes
 * about a climber live here. Signed-in only, like the rest of the app - the
 * public share page (`/u/<username>`) is a different surface and deliberately
 * stays free of text.
 *
 * Who may write follows the database rule in `can_view_wall`
 * (`supabase/migrations/20261110000000_comments.sql`): the climber themselves, an
 * accepted friend, or anyone while their profile is public. The client mirrors
 * that for the composer; RLS is what actually enforces it.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WallComments } from '../components/Comments'
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  Notice,
  PageLoader,
  SectionHeading,
  VisibilityBadge,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { displayNameOf, usernameOf } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export default function Wall() {
  const { userId: paramId } = useParams<{ userId: string }>()
  const { userId } = useAuth()
  const { friendIds, loading: friendsLoading } = useFriends()
  const [target, setTarget] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paramId) return

    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', paramId)
        .maybeSingle()

      if (!active) return

      if (profileError) setError(profileError.message)
      setTarget((data as Profile | null) ?? null)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [paramId])

  if (!paramId) {
    return (
      <EmptyState
        title="Climber not found"
        hint="That link is missing a climber id. Pick someone from the feed or your friends."
      />
    )
  }

  if (loading) return <PageLoader label="Opening the wall…" />

  if (error) return <ErrorBanner message={error} />

  if (!target) {
    return (
      <EmptyState
        title="Climber not found"
        hint="That profile does not exist, or the link is out of date."
      />
    )
  }

  const isSelf = target.id === userId
  const isFriend = friendIds.includes(target.id)
  const canComment = isSelf || isFriend || target.visibility === 'public'
  const showWall = canComment || friendsLoading
  const name = displayNameOf(target)
  const handle = usernameOf(target)

  return (
    <div className="space-y-4">
      <SectionHeading
        title={isSelf ? 'Your wall' : `${name}'s wall`}
        hint={
          isSelf
            ? 'Notes other climbers leave you, and anything you want to pin here yourself.'
            : 'Leave a note, or say when you are climbing next.'
        }
        action={
          isSelf || isFriend ? (
            <Link to={`/stats?climber=${target.id}`} className={secondaryButtonClass}>
              Stats
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="flex items-center gap-3">
          <Avatar profile={target} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{name}</p>
            {handle && handle !== name ? (
              <p className="truncate text-xs text-zinc-500">{handle}</p>
            ) : null}
          </div>
          <VisibilityBadge visibility={target.visibility} />
        </div>

        {isSelf ? (
          <p className="mt-2 text-xs text-zinc-500">
            Your wall is open to your friends, and to everyone while your profile is public.
          </p>
        ) : null}
      </Card>

      {showWall ? (
        <Card>
          <SectionHeading
            title="Wall notes"
          />
          <WallComments
            profileId={target.id}
            viewerId={userId ?? ''}
            canComment
            defaultOpen
          />
        </Card>
      ) : (
        <Notice>
          {name} keeps their wall for friends. Add them as a friend from{' '}
          <Link to="/friends" className="font-semibold underline">
            Friends
          </Link>{' '}
          to leave a note.
        </Notice>
      )}
    </div>
  )
}
