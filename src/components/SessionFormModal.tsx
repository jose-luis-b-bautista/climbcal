import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OTHER_REGION_LABEL, groupGymsByRegion } from '../lib/format'
import type { Climb, Gym } from '../types'
import {
  ErrorBanner,
  Field,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui'

const OTHER_GYM = '__other__'

interface SessionFormModalProps {
  userId: string
  gyms: Gym[]
  defaultDate: string
  /** When set the form edits this session instead of creating a new one. */
  initial?: Climb | null
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

/** Add/edit dialog for a single climbing session. */
export function SessionFormModal({
  userId,
  gyms,
  defaultDate,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: SessionFormModalProps) {
  const [date, setDate] = useState(initial?.climb_date ?? defaultDate)
  const [gymChoice, setGymChoice] = useState(
    initial?.gym_id ?? (initial?.custom_gym_name ? OTHER_GYM : ''),
  )
  const [customGym, setCustomGym] = useState(initial?.custom_gym_name ?? '')
  const [startTime, setStartTime] = useState(initial?.start_time.slice(0, 5) ?? '18:00')
  const [endTime, setEndTime] = useState(initial?.end_time.slice(0, 5) ?? '21:00')
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gyms may arrive after the dialog opens, so fall back to the first one (or
  // the free-text option) without clobbering a choice the user already made.
  const selectedGym = gymChoice || gyms[0]?.id || OTHER_GYM

  // Native <optgroup>s keep the dropdown separated by region; the free-text
  // "Other" option rides along in the Other group so there is always a way out.
  const gymGroups = groupGymsByRegion(gyms)
  const hasOtherGroup = gymGroups.some((group) => group.region === OTHER_REGION_LABEL)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!date) {
      setError('Pick a date for your session.')
      return
    }
    if (!startTime || !endTime) {
      setError('Pick both a start and an end time.')
      return
    }
    if (endTime <= startTime) {
      setError('The end time has to be after the start time.')
      return
    }

    const useOtherGym = selectedGym === OTHER_GYM
    if (useOtherGym && !customGym.trim()) {
      setError('Name the gym (or pick one from the list).')
      return
    }

    const payload = {
      user_id: userId,
      climb_date: date,
      start_time: startTime,
      end_time: endTime,
      gym_id: useOtherGym ? null : selectedGym,
      custom_gym_name: useOtherGym ? customGym.trim() : null,
      note: note.trim() || null,
    }

    setSaving(true)
    const { error: saveError } = initial
      ? await supabase.from('climbs').update(payload).eq('id', initial.id)
      : await supabase.from('climbs').insert(payload)
    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    if (!initial) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('climbs').delete().eq('id', initial.id)
    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onDeleted?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Edit session' : 'Add session'}
        className="w-full max-w-lg rounded-t-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {initial ? 'Edit session' : 'Add a session'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-xl leading-none text-zinc-400 hover:text-zinc-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Date" htmlFor="session-date">
            <input
              id="session-date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Gym" htmlFor="session-gym">
            <select
              id="session-gym"
              value={selectedGym}
              onChange={(event) => setGymChoice(event.target.value)}
              className={inputClass}
            >
              <option value="">Select a gym…</option>
              {gymGroups.map((group) => (
                <optgroup key={group.region} label={group.region}>
                  {group.gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                      {gym.city ? ` — ${gym.city}` : ''}
                    </option>
                  ))}
                  {group.region === OTHER_REGION_LABEL ? (
                    <option value={OTHER_GYM}>Other (type it in)</option>
                  ) : null}
                </optgroup>
              ))}
              {hasOtherGroup ? null : (
                <optgroup label={OTHER_REGION_LABEL}>
                  <option value={OTHER_GYM}>Other (type it in)</option>
                </optgroup>
              )}
            </select>
          </Field>

          {selectedGym === OTHER_GYM ? (
            <Field
              label="Gym name"
              htmlFor="session-custom-gym"
              hint="Great for one-off or new gyms."
            >
              <input
                id="session-custom-gym"
                type="text"
                value={customGym}
                onChange={(event) => setCustomGym(event.target.value)}
                placeholder="e.g. Boulderklub Kreuzberg"
                className={inputClass}
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="session-start">
              <input
                id="session-start"
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="To" htmlFor="session-end">
              <input
                id="session-end"
                type="time"
                required
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Note (optional)" htmlFor="session-note">
            <input
              id="session-note"
              type="text"
              value={note}
              maxLength={140}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Bouldering, bring the new shoes…"
              className={inputClass}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 pt-1">
            {initial ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                className={dangerButtonClass}
              >
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? 'Saving…' : initial ? 'Save changes' : 'Add session'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
