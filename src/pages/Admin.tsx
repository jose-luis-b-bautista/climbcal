/**
 * The hidden admin dashboard — reachable only by typing `/admin` (nothing links
 * to it) and gated by a shared password.
 *
 * The password is a convenience lock, not a security boundary: it ships in the
 * bundle. Real protection is `profiles.is_admin` + RLS, so a non-admin who
 * unlocks the UI still cannot write anything (see `lib/admin.ts`).
 */
import { useEffect, useState } from 'react'
import {
  Card,
  ErrorBanner,
  Field,
  Notice,
  PageLoader,
  SectionHeading,
  Select,
  dangerButtonClass,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { useGyms } from '../hooks/useGyms'
import { ADMIN_PASSWORD, isAdminUnlocked, lockAdmin, unlockAdmin } from '../lib/admin'
import { addDays, toISODate } from '../lib/date'
import { GYM_REGIONS, groupGymsByRegion } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Gym } from '../types'

/** How far ahead the "coming up" stat looks. */
const HORIZON_DAYS = 21

interface Counts {
  climbers: number
  publicClimbers: number
  gyms: number
  upcoming: number
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value ?? '—'}</p>
    </div>
  )
}

/** Row counts. `head: true` counts without shipping the rows. */
function AdminStats() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      const today = toISODate(new Date())
      const horizon = toISODate(addDays(new Date(), HORIZON_DAYS))

      const [climbers, publicClimbers, gyms, upcoming] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('visibility', 'public'),
        supabase.from('gyms').select('id', { count: 'exact', head: true }),
        supabase
          .from('climbs')
          .select('id', { count: 'exact', head: true })
          .gte('climb_date', today)
          .lte('climb_date', horizon),
      ])

      if (!active) return

      const failure = [climbers, publicClimbers, gyms, upcoming].find((result) => result.error)
      if (failure?.error) {
        setError(failure.error.message)
        return
      }

      setCounts({
        climbers: climbers.count ?? 0,
        publicClimbers: publicClimbers.count ?? 0,
        gyms: gyms.count ?? 0,
        upcoming: upcoming.count ?? 0,
      })
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <Card>
      <SectionHeading
        title="Numbers"
        hint={`Sessions counted for the next ${HORIZON_DAYS} days.`}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Climbers" value={counts?.climbers ?? null} />
        <Stat label="Public" value={counts?.publicClimbers ?? null} />
        <Stat label="Gyms listed" value={counts?.gyms ?? null} />
        <Stat label="Sessions ahead" value={counts?.upcoming ?? null} />
      </div>
    </Card>
  )
}

/** Add, rename and retire the gyms everyone picks from. */
function GymManager() {
  const { gyms, loading, error, reload } = useGyms()
  const [editing, setEditing] = useState<Gym | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const resetForm = () => {
    setEditing(null)
    setName('')
    setCity('')
    setRegion('')
    setFormError(null)
  }

  const startEdit = (gym: Gym) => {
    setEditing(gym)
    setName(gym.name)
    setCity(gym.city ?? '')
    setRegion(gym.region ?? '')
    setFormError(null)
    setMessage(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setMessage(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('A gym needs a name.')
      return
    }

    const payload = { name: trimmed, city: city.trim() || null, region: region.trim() || null }
    setBusy(true)
    const { error: saveError } = editing
      ? await supabase.from('gyms').update(payload).eq('id', editing.id)
      : await supabase.from('gyms').insert(payload)
    setBusy(false)

    if (saveError) {
      setFormError(saveError.code === '23505' ? 'That gym already exists.' : saveError.message)
      return
    }

    setMessage(editing ? `${trimmed} updated.` : `${trimmed} added.`)
    resetForm()
    reload()
  }

  const remove = async (gym: Gym) => {
    if (!window.confirm(`Delete ${gym.name}? Sessions that used it keep their own name text.`)) {
      return
    }

    setFormError(null)
    setMessage(null)
    const { error: deleteError } = await supabase.from('gyms').delete().eq('id', gym.id)

    if (deleteError) {
      setFormError(deleteError.message)
      return
    }

    setMessage(`${gym.name} deleted.`)
    if (editing?.id === gym.id) resetForm()
    reload()
  }

  return (
    <Card>
      <SectionHeading
        title="Gyms"
        hint="The shared list every climber picks from. Deleting one keeps the sessions that used it."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {formError ? (
        <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <form
        onSubmit={save}
        className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
      >
        <Field label="Gym name" htmlFor="admin-gym-name">
          <input
            id="admin-gym-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Boulder Space"
            className={inputClass}
          />
        </Field>

        <Field label="City (optional)" htmlFor="admin-gym-city">
          <input
            id="admin-gym-city"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Region (optional)" htmlFor="admin-gym-region">
          <Select
            id="admin-gym-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            <option value="">No region</option>
            {GYM_REGIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add gym'}
          </button>
          {editing ? (
            <button type="button" className={secondaryButtonClass} onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <PageLoader label="Loading gyms…" />
      ) : (
        <div className="mt-4 space-y-4">
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
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => startEdit(gym)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        onClick={() => void remove(gym)}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== ADMIN_PASSWORD) {
      setError('That is not the password.')
      return
    }
    unlockAdmin()
    setUnlocked(true)
    setPassword('')
    setError(null)
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <SectionHeading title="Admin" hint="Restricted area." />
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Password" htmlFor="admin-password">
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            {error ? <ErrorBanner message={error} /> : null}
            <button type="submit" className={primaryButtonClass}>
              Unlock
            </button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Admin"
        hint="The gym list, and a quick look at the numbers."
        action={
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              lockAdmin()
              setUnlocked(false)
            }}
          >
            Lock
          </button>
        }
      />

      <Notice>
        Hidden route: nothing links here. The password is only a convenience lock — anyone can read
        it out of the bundle — so the real gate is <code>profiles.is_admin</code> + RLS. Promote
        yourself once in the SQL editor:{' '}
        <code>update public.profiles set is_admin = true where username = '&lt;you&gt;';</code>
      </Notice>

      <AdminStats />
      <GymManager />
    </div>
  )
}
