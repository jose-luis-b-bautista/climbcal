/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// The auth context intentionally exports both <AuthProvider> and useAuth().
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextValue {
  session: Session | null
  userId: string | null
  profile: Profile | null
  /** True while the initial session lookup is running. */
  loading: boolean
  /** True while the profile row is being (or about to be) fetched. */
  profileLoading: boolean
  /** Session resolved and the profile row was read for this user. */
  profileResolved: boolean
  /** Signed in, profile read, but no username chosen yet. */
  needsOnboarding: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Nothing to load when the project keys are missing, so start settled.
  const [loading, setLoading] = useState(isSupabaseConfigured)
  // Which user id the profile row has been read for. Deriving the loading and
  // onboarding flags from this avoids a window where a signed-in user looks
  // like a brand-new account before the fetch has even started.
  const [resolvedForUserId, setResolvedForUserId] = useState<string | null>(null)
  const userId = session?.user.id ?? null
  // Signed out ⇒ no profile, without needing to clear it inside an effect.
  const activeProfile = userId ? profile : null
  const profileResolved = Boolean(userId) && resolvedForUserId === userId
  const profileLoading = Boolean(userId) && !profileResolved

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) setProfile(null)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const loadProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[climbcal] failed to load profile', error)
      setProfile(null)
    } else {
      setProfile(data)
    }
    setResolvedForUserId(id)
  }, [])

  useEffect(() => {
    if (!userId) return

    // Fetch from an async context so the effect body itself stays free of
    // setState; event handlers can call refreshProfile() directly.
    const run = async () => {
      await loadProfile(userId)
    }

    void run()
  }, [userId, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [userId, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId,
      profile: activeProfile,
      loading,
      profileLoading,
      profileResolved,
      needsOnboarding: profileResolved && !activeProfile?.username,
      refreshProfile,
      signOut,
    }),
    [
      session,
      userId,
      activeProfile,
      loading,
      profileLoading,
      profileResolved,
      refreshProfile,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
