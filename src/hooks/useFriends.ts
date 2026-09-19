import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Friendship, Profile } from '../types'

interface UseFriendsResult {
  /** Every friendship row involving the current user. */
  rows: Friendship[]
  /** Profiles of the other party, keyed by user id. */
  profiles: Record<string, Profile>
  /** Accepted friends, sorted by display name. */
  friends: Profile[]
  /** Pending requests the current user has received. */
  incoming: Friendship[]
  /** Pending requests the current user has sent. */
  outgoing: Friendship[]
  /** Accepted friend ids, ready for `.in('user_id', ...)` queries. */
  friendIds: string[]
  loading: boolean
  error: string | null
  reload: () => void
  sendRequest: (targetId: string) => Promise<void>
  acceptRequest: (friendshipId: string) => Promise<void>
  declineRequest: (friendshipId: string) => Promise<void>
  removeFriend: (friendshipId: string) => Promise<void>
  searchProfiles: (term: string) => Promise<Profile[]>
  /** The row linking the current user to `userId`, if any. */
  relationFor: (userId: string) => Friendship | null
}

export function useFriends(enabled = true): UseFriendsResult {
  const { userId } = useAuth()
  const [rows, setRows] = useState<Friendship[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(enabled && Boolean(userId))
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    if (!enabled || !userId) return

    let active = true

    // All state updates live inside this async function so the effect body
    // never triggers a synchronous re-render.
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data, error: rowsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!active) return

      if (rowsError) {
        setError(rowsError.message)
        setRows([])
        setProfiles({})
        setLoading(false)
        return
      }

      const friendshipRows = (data ?? []) as Friendship[]
      const otherIds = Array.from(
        new Set(
          friendshipRows.map((row) =>
            row.requester_id === userId ? row.addressee_id : row.requester_id,
          ),
        ),
      )

      let profileMap: Record<string, Profile> = {}
      if (otherIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', otherIds)

        if (!active) return

        if (profilesError) {
          setError(profilesError.message)
        } else {
          profileMap = Object.fromEntries((profileRows ?? []).map((row) => [row.id, row]))
        }
      }

      setRows(friendshipRows)
      setProfiles(profileMap)
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [userId, enabled, nonce])

  const friendIds = useMemo(
    () =>
      rows
        .filter((row) => row.status === 'accepted')
        .map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id)),
    [rows, userId],
  )

  const friends = useMemo(
    () =>
      friendIds
        .map((id) => profiles[id])
        .filter((profile): profile is Profile => Boolean(profile))
        .sort((a, b) =>
          (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? ''),
        ),
    [friendIds, profiles],
  )

  const incoming = useMemo(
    () => rows.filter((row) => row.status === 'pending' && row.addressee_id === userId),
    [rows, userId],
  )

  const outgoing = useMemo(
    () => rows.filter((row) => row.status === 'pending' && row.requester_id === userId),
    [rows, userId],
  )

  const sendRequest = useCallback(
    async (targetId: string) => {
      if (!userId) throw new Error('You must be signed in.')
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({ requester_id: userId, addressee_id: targetId, status: 'pending' })

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('You already have a friendship or pending request with this climber.')
        }
        throw new Error(insertError.message)
      }
      reload()
    },
    [userId, reload],
  )

  const acceptRequest = useCallback(
    async (friendshipId: string) => {
      const { error: updateError } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

      if (updateError) throw new Error(updateError.message)
      reload()
    },
    [reload],
  )

  const deleteRow = useCallback(
    async (friendshipId: string, fallbackMessage: string) => {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (deleteError) throw new Error(deleteError.message || fallbackMessage)
      reload()
    },
    [reload],
  )

  const declineRequest = useCallback(
    (friendshipId: string) => deleteRow(friendshipId, 'Could not decline the request.'),
    [deleteRow],
  )

  const removeFriend = useCallback(
    (friendshipId: string) => deleteRow(friendshipId, 'Could not remove the friend.'),
    [deleteRow],
  )

  const searchProfiles = useCallback(
    async (term: string) => {
      const cleaned = term.trim().replace(/^@/, '')
      if (!userId || cleaned.length < 2) return []

      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${cleaned}%`)
        .neq('id', userId)
        .not('username', 'is', null)
        .order('username', { ascending: true })
        .limit(20)

      if (searchError) throw new Error(searchError.message)
      return (data ?? []) as Profile[]
    },
    [userId],
  )

  const relationFor = useCallback(
    (otherId: string) =>
      rows.find(
        (row) =>
          (row.requester_id === userId && row.addressee_id === otherId) ||
          (row.requester_id === otherId && row.addressee_id === userId),
      ) ?? null,
    [rows, userId],
  )

  return {
    rows,
    profiles,
    friends,
    incoming,
    outgoing,
    friendIds,
    loading: enabled && userId ? loading : false,
    error,
    reload,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    searchProfiles,
    relationFor,
  }
}
