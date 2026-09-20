import { useState } from 'react'
import {
  Card,
  ErrorBanner,
  Field,
  Notice,
  SectionHeading,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useGyms } from '../hooks/useGyms'
import { GYM_REGIONS, groupGymsByRegion, normaliseUsername } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Visibility } from '../types'

/** Sentinel for the "type your own region" branch of the region select. */
const OTHER_REGION = '__other__'

export default function Settings() {
  const { profile, session, userId, refreshProfile, signOut } = useAuth()
  const { gyms, addGym, loading: gymsLoading, error: gymsError, reload: reloadGyms } = useGyms()

  // Settings only renders once RequireProfile has loaded the row, so the
  // current values can seed the form directly.
  const [username, setUsername] = useState(profile?.username ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [visibility, setVisibility] = useState<Visibility>(profile?.visibility ?? 'private')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [gymName, setGymName] = useState('')
  const [gymCity, setGymCity] = useState('')
  const [gymRegion, setGymRegion] = useState('')
  const [gymCustomRegion, setGymCustomRegion] = useState('')
  const [gymBusy, setGymBusy] = useState(false)
  const [gymMessage, setGymMessage] = useState<string | null>(null)
  const [gymFormError, setGymFormError] = useState<string | null>(null)

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

  const handleAddGym = async (event: React.FormEvent) => {
    event.preventDefault()
    setGymFormError(null)
    setGymMessage(null)

    if (!gymName.trim()) {
      setGymFormError('Enter the gym name.')
      return
    }
    if (gymRegion === OTHER_REGION && !gymCustomRegion.trim()) {
      setGymFormError('Name the region (or pick one from the list).')
      return
    }

    const region = gymRegion === OTHER_REGION ? gymCustomRegion : gymRegion

    setGymBusy(true)
    try {
      const created = await addGym(gymName, gymCity, region)
      setGymName('')
      setGymCity('')
      setGymRegion('')
      setGymCustomRegion('')
      setGymMessage(`${created.name} added to the gym list.`)
    } catch (failure) {
      setGymFormError(failure instanceof Error ? failure.message : 'Could not add the gym.')
    } finally {
      setGymBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Settings" hint="Your profile, visibility, and the shared gym list." />

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
          title="Gyms"
          hint="Seeded gyms grouped by region, plus anything you add. One-off names in a session don't need a gym row."
          action={
            <button type="button" className={ghostButtonClass} onClick={reloadGyms}>
              Refresh
            </button>
          }
        />

        {gymsError ? <ErrorBanner message={gymsError} /> : null}
        {gymFormError ? (
          <ErrorBanner message={gymFormError} onDismiss={() => setGymFormError(null)} />
        ) : null}
        {gymMessage ? <Notice tone="success">{gymMessage}</Notice> : null}

        <form
          onSubmit={handleAddGym}
          className="mt-3 mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        >
          <Field label="Gym name" htmlFor="gym-name">
            <input
              id="gym-name"
              type="text"
              value={gymName}
              onChange={(event) => setGymName(event.target.value)}
              placeholder="e.g. Boulder Space"
              className={inputClass}
            />
          </Field>

          <Field label="City (optional)" htmlFor="gym-city">
            <input
              id="gym-city"
              type="text"
              value={gymCity}
              onChange={(event) => setGymCity(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Region (optional)" htmlFor="gym-region">
            <select
              id="gym-region"
              value={gymRegion}
              onChange={(event) => setGymRegion(event.target.value)}
              className={inputClass}
            >
              <option value="">No region</option>
              {GYM_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
              <option value={OTHER_REGION}>Other…</option>
            </select>
          </Field>

          <button type="submit" disabled={gymBusy} className={primaryButtonClass}>
            {gymBusy ? 'Adding…' : 'Add gym'}
          </button>
        </form>

        {gymRegion === OTHER_REGION ? (
          <div className="mb-4">
            <Field
              label="Region name"
              htmlFor="gym-custom-region"
              hint="Anything you like — it gets its own group in the list and the session dropdown."
            >
              <input
                id="gym-custom-region"
                type="text"
                value={gymCustomRegion}
                onChange={(event) => setGymCustomRegion(event.target.value)}
                placeholder="e.g. Cordillera"
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}

        {gymsLoading ? (
          <p className="text-sm text-zinc-500">Loading gyms…</p>
        ) : (
          <div className="space-y-4">
            {groupGymsByRegion(gyms).map((group) => (
              <div key={group.region}>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {group.region}
                </h3>
                <ul className="divide-y divide-zinc-800/80">
                  {group.gyms.map((gym) => (
                    <li key={gym.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm text-zinc-200">
                        {gym.name}
                        {gym.city ? <span className="text-zinc-500"> — {gym.city}</span> : null}
                      </span>
                      {gym.created_by === userId ? (
                        <span className="text-xs text-emerald-400">yours</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
