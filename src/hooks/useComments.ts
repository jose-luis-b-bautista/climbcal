import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommentEntry, Profile } from '../types'
import { useAuth } from './useAuth'

/** Where a thread hangs: a session, or a climber's wall. */
export type CommentKind = 'climb' | 'profile'

/** Mirrors `climb_comments_body_length` / `profile_comments_body_length` (characters). */
export const COMMENT_MAX_LENGTH = 280

/** The row fields a thread needs - the same for both tables. */
type CommentRow = {
  id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
}

interface UseCommentsArgs {
  kind: CommentKind
  targetId: string | null
  /** Load on mount; the cards pass `enabled: open` so collapsed cards stay quiet. */
  enabled?: boolean
}

interface UseCommentsResult {
  comments: CommentEntry[]
  loading: boolean
  error: string | null
  /** The migration has not been applied yet, so the table is absent. */
  missingTable: boolean
  reload: () => void
  post: (body: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** PostgREST's "relation does not exist" - the comments migration is not deployed. */
function isMissingTable(error: { code?: string; message: string }): boolean {
  return error.code === '42P01' || /does not exist/i.test(error.message)
}

/** Stand-in profile for an author whose row could not be read. */
function unknownAuthor(userId: string, timestamp: string): Profile {
  return {
    id: userId,
    username: null,
    display_name: null,
    visibility: 'private',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

/**
 * One flat comment thread - a session's comments or a climber's wall.
 *
 * Reads mirror the RLS rules in `supabase/migrations/20261110000000_comments.sql`:
 * the query asks for every row it is allowed to see, then joins the author
 * profiles in a second call (the same two-step join as `useWeekClimbs`). A thread
 * stays collapsed until the reader opens it, so a feed of cards does not fire a
 * query per session.
 */
export function useComments({ kind, targetId, enabled = true }: UseCommentsArgs): UseCommentsResult {
  const { userId: viewerId, profile: viewerProfile } = useAuth()
  const [rows, setRows] = useState<CommentRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(enabled && Boolean(targetId))
  const [error, setError] = useState<string | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!enabled || !targetId) return

    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      // Drop the previous target's thread while this one loads (a wall-to-wall
      // hop must not flash someone else's notes under the new heading).
      setRows([])
      setProfiles({})

      const { data, error: rowsError } =
        kind === 'climb'
          ? await supabase
              .from('climb_comments')
              .select('*')
              .eq('climb_id', targetId)
              .order('created_at', { ascending: true })
          : await supabase
              .from('profile_comments')
              .select('*')
              .eq('profile_id', targetId)
              .order('created_at', { ascending: true })

      if (!active) return

      if (rowsError) {
        setError(rowsError.message)
        setMissingTable(isMissingTable(rowsError))
        setRows([])
        setProfiles({})
        setLoading(false)
        return
      }

      setMissingTable(false)
      const commentRows = (data ?? []) as CommentRow[]
      const authorIds = Array.from(new Set(commentRows.map((row) => row.user_id)))

      let profileMap: Record<string, Profile> = {}
      if (authorIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', authorIds)

        if (!active) return

        if (profilesError) {
          setError(profilesError.message)
        } else {
          profileMap = Object.fromEntries((profileRows ?? []).map((row) => [row.id, row]))
        }
      }

      setRows(commentRows)
      setProfiles(profileMap)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [kind, targetId, enabled, nonce])

  const comments = useMemo<CommentEntry[]>(
    () =>
      rows.map((row) => ({
        ...row,
        author: profiles[row.user_id] ?? unknownAuthor(row.user_id, row.created_at),
      })),
    [rows, profiles],
  )

  const post = useCallback(
    async (body: string) => {
      const text = body.trim()
      if (!text || !targetId) return
      if (!viewerId) throw new Error('Sign in to add a comment.')

      // Branch the insert per table so the generated row type stays exact.
      const { data, error: insertError } =
        kind === 'climb'
          ? await supabase
              .from('climb_comments')
              .insert({ climb_id: targetId, user_id: viewerId, body: text })
              .select('*')
              .single()
          : await supabase
              .from('profile_comments')
              .insert({ profile_id: targetId, user_id: viewerId, body: text })
              .select('*')
              .single()

      if (insertError) {
        setMissingTable(isMissingTable(insertError))
        throw new Error(insertError.message)
      }

      // Show it at once: the row is ours, so the author profile is right here.
      if (data) {
        setRows((current) => [...current, data as CommentRow])
        if (viewerProfile) {
          setProfiles((current) => ({ ...current, [viewerId]: viewerProfile }))
        }
      }
    },
    [kind, targetId, viewerId, viewerProfile],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } =
        kind === 'climb'
          ? await supabase.from('climb_comments').delete().eq('id', id)
          : await supabase.from('profile_comments').delete().eq('id', id)

      if (deleteError) {
        setMissingTable(isMissingTable(deleteError))
        throw new Error(deleteError.message)
      }

      setRows((current) => current.filter((row) => row.id !== id))
    },
    [kind],
  )

  return {
    comments,
    loading: enabled && targetId ? loading : false,
    error,
    missingTable,
    reload,
    post,
    remove,
  }
}

/**
 * Comment counts for many targets at once, keyed by climb / wall id.
 *
 * One request per page rather than one per card: the collapsed cards only need
 * the number beside their toggle. A failure (including the migration not being
 * applied yet) reads as "no counts", never as a broken page.
 */
export function useCommentCounts(
  kind: CommentKind,
  targetIds: string[],
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const idsKey = useMemo(
    () =>
      Array.from(new Set(targetIds.filter(Boolean)))
        .sort()
        .join(','),
    [targetIds],
  )

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) return

    let active = true

    /** Groups rows by their target column into a `{ id: count }` map. */
    const tally = (rows: Array<Record<string, unknown>>, column: string) => {
      const next: Record<string, number> = {}
      for (const row of rows) {
        const key = row[column]
        if (typeof key === 'string') next[key] = (next[key] ?? 0) + 1
      }
      return next
    }

    const load = async () => {
      if (kind === 'climb') {
        const { data, error } = await supabase
          .from('climb_comments')
          .select('climb_id')
          .in('climb_id', ids)
        if (!active) return
        setCounts(error ? {} : tally((data ?? []) as Array<Record<string, unknown>>, 'climb_id'))
        return
      }

      const { data, error } = await supabase
        .from('profile_comments')
        .select('profile_id')
        .in('profile_id', ids)
      if (!active) return
      setCounts(error ? {} : tally((data ?? []) as Array<Record<string, unknown>>, 'profile_id'))
    }

    void load()

    return () => {
      active = false
    }
  }, [kind, idsKey])

  // An empty list has no counts - derived here so the effect never has to clear
  // state for the "everyone disappeared" case.
  return idsKey ? counts : {}
}
