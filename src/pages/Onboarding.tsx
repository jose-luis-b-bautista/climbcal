import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ErrorBanner,
  Field,
  PageLoader,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { normaliseUsername } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Profile, Visibility } from '../types'

/** First-run step: pick a username, a display name, and profile visibility. */
export default function Onboarding() {
  const { profile, profileLoading } = useAuth()

  if (profileLoading) return <PageLoader label="Loading your profile…" />

  // The form is only mounted once the profile row is known, so it can take the
  // saved values as its initial state. `key` remounts it if the row changes.
  return <OnboardingForm key={profile?.id ?? 'new'} initialProfile={profile} />
}

function OnboardingForm({ initialProfile }: { initialProfile: Profile | null }) {
  const { session, userId, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(initialProfile?.username ?? '')
  const [displayName, setDisplayName] = useState(initialProfile?.display_name ?? '')
  const [visibility, setVisibility] = useState<Visibility>(
    initialProfile?.visibility ?? 'private',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!userId) {
      setError('You need to be signed in.')
      return
    }

    const result = normaliseUsername(username)
    if ('error' in result) {
      setError(result.error)
      return
    }

    setBusy(true)
    const { error: saveError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        username: result.value,
        display_name: displayName.trim() || null,
        visibility,
      },
      { onConflict: 'id' },
    )
    setBusy(false)

    if (saveError) {
      if (saveError.code === '23505') {
        setError('That username is already taken — try another one.')
        return
      }
      setError(saveError.message)
      return
    }

    await refreshProfile()
    navigate('/week', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <p className="text-3xl" aria-hidden="true">
          🧗
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
          Set up your climber profile
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {session?.user.email ?? 'you'}. This is what friends will see.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Username" htmlFor="onboarding-username" hint="Letters, numbers, underscores.">
            <input
              id="onboarding-username"
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="luis_climbs"
              className={inputClass}
            />
          </Field>

          <Field label="Display name" htmlFor="onboarding-display-name">
            <input
              id="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Luis"
              className={inputClass}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-zinc-300">Who can see your sessions?</legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="mt-1 accent-emerald-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-zinc-200">Private</span>
                <span className="block text-zinc-400">Only your accepted friends can see your week.</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="mt-1 accent-emerald-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-zinc-200">Public</span>
                <span className="block text-zinc-400">
                  Any signed-in climber can see your week, and you show up on the public feed.
                </span>
              </span>
            </label>
          </fieldset>

          <button type="submit" disabled={busy} className={`${primaryButtonClass} w-full`}>
            {busy ? 'Saving…' : 'Start climbing'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void signOut()}
          className={`${secondaryButtonClass} mt-3 w-full`}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
