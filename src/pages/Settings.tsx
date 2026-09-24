import { useState } from 'react'
import { ShareLink } from '../components/ShareLink'
import {
  Card,
  ErrorBanner,
  Field,
  Notice,
  SectionHeading,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { normaliseUsername } from '../lib/format'
import { profileSharePath } from '../lib/routes'
import { supabase } from '../lib/supabase'
import type { Visibility } from '../types'

export default function Settings() {
  const { profile, session, userId, refreshProfile, signOut } = useAuth()

  // Settings only renders once RequireProfile has loaded the row, so the
  // current values can seed the form directly.
  const [username, setUsername] = useState(profile?.username ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [visibility, setVisibility] = useState<Visibility>(profile?.visibility ?? 'private')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaved(false)

    if (!userId) {
      setError('You need to be signed in.')
      return
    }

    const result = normaliseUsername(username)
    if ('error' in result) {
      setError(result.error)
      return
    }

    setSaving(true)
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        username: result.value,
        display_name: displayName.trim() || null,
        visibility,
      })
      .eq('id', userId)
    setSaving(false)

    if (saveError) {
      if (saveError.code === '23505') {
        setError('That username is already taken — try another one.')
        return
      }
      setError(saveError.message)
      return
    }

    await refreshProfile()
    setSaved(true)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Settings"
        hint="Your profile, and who can see your climbing week."
      />

      <Card>
        <SectionHeading
          title="Profile"
          hint={`Signed in as ${session?.user.email ?? 'unknown'}.`}
        />

        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
        {saved ? <Notice tone="success">Profile updated.</Notice> : null}

        <form onSubmit={handleSave} className="mt-3 space-y-4">
          <Field label="Username" htmlFor="settings-username">
            <input
              id="settings-username"
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Display name" htmlFor="settings-display-name">
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-zinc-300">Profile visibility</legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
              <input
                type="radio"
                name="settings-visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
                className="mt-1 accent-emerald-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-zinc-200">Private</span>
                <span className="block text-zinc-400">Only accepted friends see your week.</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-3">
              <input
                type="radio"
                name="settings-visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                className="mt-1 accent-emerald-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-zinc-200">Public</span>
                <span className="block text-zinc-400">
                  Any signed-in climber can see your week, and you appear on the public feed.
                </span>
              </span>
            </label>
          </fieldset>

          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </Card>

      <Card>
        <SectionHeading
          title="Share"
          hint="A link to your climbing week that works for people without an account."
        />

        {profile?.username ? (
          <>
            <ShareLink path={profileSharePath(profile.username)} />
            <p className="mt-2 text-sm text-zinc-400">
              {profile.visibility === 'public' ? (
                <>
                  Anyone with this link sees the time and gym of each session — never your notes.
                  You can stop sharing by switching to Private.
                </>
              ) : (
                <>
                  Only public profiles are shared. Switch to <strong>Public</strong> above and save
                  to make this link work for visitors who are not signed in.
                </>
              )}
            </p>
          </>
        ) : (
          <Notice>Choose a username first — your link is built from it.</Notice>
        )}
      </Card>

      <Card>
        <SectionHeading title="Account" hint="Sign out of this browser." />
        <button type="button" className={secondaryButtonClass} onClick={() => void signOut()}>
          Sign out
        </button>
      </Card>
    </div>
  )
}
