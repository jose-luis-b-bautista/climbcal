import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { Notice, PageLoader } from './ui'

/** Shown when the Vite env vars are missing so setup failures are obvious. */
export function SetupRequired() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="mb-3 text-2xl font-semibold text-zinc-100">climbcal needs Supabase keys</h1>
      <Notice>
        Create <code>.env.local</code> next to <code>package.json</code> with{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart{' '}
        <code>npm run dev</code>. See README.md for the full setup.
      </Notice>
    </div>
  )
}

/** Session gate: everything below here requires a signed-in user. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return <SetupRequired />
  if (loading) return <PageLoader label="Checking your session…" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}

/** Session gate plus "username chosen" gate for the main app surfaces. */
export function RequireProfile() {
  const { session, loading, profileLoading, needsOnboarding } = useAuth()

  if (!isSupabaseConfigured) return <SetupRequired />
  if (loading) return <PageLoader label="Checking your session…" />
  if (!session) return <Navigate to="/login" replace />
  // Wait for the profile row to be read before deciding on onboarding, so a
  // reload with a valid session never bounces a real user through it.
  if (profileLoading) return <PageLoader label="Loading your profile…" />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
