import { useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { SetupRequired } from '../components/ProtectedRoute'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  ErrorBanner,
  Field,
  Notice,
  PageLoader,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { loginRedirectPath, safeRedirectPath } from '../lib/routes'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // A share link (`/u/<username>`) sends visitors here with `?next=` so they can
  // come back to it, and the email-confirmation round trip returns to this same
  // URL — which is why the param is read from the query, not from router state.
  const nextParam = searchParams.get('next')
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  if (!isSupabaseConfigured) return <SetupRequired />
  if (loading) return <PageLoader label="Checking your session…" />
  if (session) {
    const redirectTo = loginRedirectPath({
      next: nextParam,
      from: (location.state as { from?: string } | null)?.from,
    })
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)

    if (mode === 'signup') {
      const next = safeRedirectPath(nextParam)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        // With "Confirm email" on the visitor leaves the app for their inbox, so
        // this is what brings them back to the page that sent them here.
        options: next
          ? {
              emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}`,
            }
          : undefined,
      })
      setBusy(false)
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      // With email confirmation on, no session is returned until the link is clicked.
      if (!data.session) setConfirmationSent(true)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (signInError) setError(signInError.message)
  }

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="mb-6 text-center">
        <p className="text-3xl" aria-hidden="true">
          🧗
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">climbcal</h1>
        <p className="mt-1 text-sm text-zinc-400">
          See who is climbing, where, and when — this week.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        {confirmationSent ? (
          <div className="space-y-3">
            <Notice tone="success">
              Check your inbox — confirm your email address, then come back and sign in.
            </Notice>
            <button
              type="button"
              onClick={() => {
                setConfirmationSent(false)
                setMode('signin')
              }}
              className={`${secondaryButtonClass} w-full`}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950/60 p-1">
              {(['signin', 'signup'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value)
                    setError(null)
                  }}
                  className={
                    mode === value
                      ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-100'
                      : 'rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200'
                  }
                >
                  {value === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {error ? <ErrorBanner message={error} /> : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" htmlFor="auth-email">
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Password"
                htmlFor="auth-password"
                hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
              >
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </Field>
              {mode === 'signin' ? (
                <p className="text-sm text-zinc-400">
                  Forgot your password? Contact the owner (luis) of this app to reset it.
                </p>
              ) : null}

              <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full`}>
                {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
