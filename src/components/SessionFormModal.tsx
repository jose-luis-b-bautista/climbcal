import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { windowMinutes } from '../lib/date'
import { OTHER_REGION_LABEL, groupGymsByRegion } from '../lib/format'
import { TIME_SLOTS } from '../lib/slots'
import type { Climb, Gym } from '../types'
import {
  ErrorBanner,
  Field,
  Select,
  dangerButtonClass,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui'

const OTHER_GYM = '__other__'
/** Sentinel for "use an exact clock time" in the From / To selects. */
const EXACT_TIME = '__exact__'

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
  // The optional alternative gym ("either"): its own pair of columns, and the
  // picker only appears once the user asks for it.
  const [secondGymOpen, setSecondGymOpen] = useState(
    Boolean(initial?.gym_id_2 ?? initial?.custom_gym_name_2),
  )
  const [gymChoice2, setGymChoice2] = useState(
    initial?.gym_id_2 ?? (initial?.custom_gym_name_2 ? OTHER_GYM : ''),
  )
  const [customGym2, setCustomGym2] = useState(initial?.custom_gym_name_2 ?? '')
  // Each end of the window is either an exact clock time or a time-of-day slot
  // ("Opening", "Before Dinner", …), so the preset survives an edit round trip.
  const [startKind, setStartKind] = useState<string>(initial?.start_slot ?? EXACT_TIME)
  const [endKind, setEndKind] = useState<string>(initial?.end_slot ?? EXACT_TIME)
  const [startTime, setStartTime] = useState(initial?.start_time?.slice(0, 5) ?? '18:00')
  const [endTime, setEndTime] = useState(initial?.end_time?.slice(0, 5) ?? '21:00')
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Native <optgroup>s keep the dropdown separated by region; the free-text
  // "Other" option rides along in the Other group so there is always a way out.
  // The same options are reused by the optional second-gym picker.
  const gymGroups = groupGymsByRegion(gyms)
  const hasOtherGroup = gymGroups.some((group) => group.region === OTHER_REGION_LABEL)

  const gymOptions = (
    <>
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
    </>
  )

  const closeSecondGym = () => {
    setSecondGymOpen(false)
    setGymChoice2('')
    setCustomGym2('')
  }

  const startIsExact = startKind === EXACT_TIME
  const endIsExact = endKind === EXACT_TIME

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

    // Compare both forms on the canonical clock so a slot can sit next to an
    // exact time ("Opening" → "21:00").
    const startAt = windowMinutes(startIsExact ? startTime : null, startIsExact ? null : startKind)
    const endAt = windowMinutes(endIsExact ? endTime : null, endIsExact ? null : endKind)

    if (startAt === null) {
      setError('Pick when the session starts.')
      return
    }
    if (endAt === null) {
      setError('Pick when the session ends.')
      return
    }
    if (endAt <= startAt) {
      setError('The end has to come after the start.')
      return
    }

    if (gymChoice === OTHER_GYM && !customGym.trim()) {
      setError('Name the gym (or pick one from the list).')
      return
    }
    if (secondGymOpen && gymChoice2 === OTHER_GYM && !customGym2.trim()) {
      setError('Name the second gym (or pick one from the list).')
      return
    }

    // One slot is one gym or one typed name; an empty slot means "not sure yet".
    const gymSlot = (choice: string, custom: string) => {
      if (choice === OTHER_GYM) return { gym_id: null, custom_gym_name: custom.trim() || null }
      if (choice) return { gym_id: choice, custom_gym_name: null }
      return { gym_id: null, custom_gym_name: null }
    }

    const emptySlot = { gym_id: null, custom_gym_name: null }
    let firstGym = gymSlot(gymChoice, customGym)
    let secondGym = secondGymOpen ? gymSlot(gymChoice2, customGym2) : emptySlot

    // A second gym without a first one is simply the gym.
    if (!firstGym.gym_id && !firstGym.custom_gym_name && (secondGym.gym_id || secondGym.custom_gym_name)) {
      firstGym = secondGym
      secondGym = emptySlot
    }

    const firstKey = firstGym.gym_id ?? firstGym.custom_gym_name
    const secondKey = secondGym.gym_id ?? secondGym.custom_gym_name
    if (firstKey && secondKey && firstKey === secondKey) {
      setError('Pick two different gyms, or leave the second one empty.')
      return
    }

    const payload = {
      user_id: userId,
      climb_date: date,
      start_time: startIsExact ? startTime : null,
      end_time: endIsExact ? endTime : null,
      start_slot: startIsExact ? null : startKind,
      end_slot: endIsExact ? null : endKind,
      gym_id: firstGym.gym_id,
      custom_gym_name: firstGym.custom_gym_name,
      gym_id_2: secondGym.gym_id,
      custom_gym_name_2: secondGym.custom_gym_name,
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
            <Select
              id="session-gym"
              value={gymChoice}
              onChange={(event) => setGymChoice(event.target.value)}
            >
              <option value="">Not sure yet</option>
              {gymOptions}
            </Select>
          </Field>

          {gymChoice === OTHER_GYM ? (
            <Field
              label="Gym name"
              htmlFor="session-custom-gym"
              hint="No need to add it to the list — a one-off name is fine."
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

          {secondGymOpen ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-300">Either also this gym</p>
                <button type="button" className={ghostButtonClass} onClick={closeSecondGym}>
                  Remove
                </button>
              </div>

              <Select
                id="session-gym-2"
                aria-label="Second gym"
                value={gymChoice2}
                onChange={(event) => setGymChoice2(event.target.value)}
              >
                <option value="">No second gym</option>
                {gymOptions}
              </Select>

              {gymChoice2 === OTHER_GYM ? (
                <input
                  id="session-custom-gym-2"
                  type="text"
                  aria-label="Second gym name"
                  value={customGym2}
                  onChange={(event) => setCustomGym2(event.target.value)}
                  placeholder="e.g. Boulderklub Kreuzberg"
                  className={`${inputClass} mt-2`}
                />
              ) : null}

              <p className="mt-2 text-xs text-zinc-500">
                Friends will see it as “Either … or …”.
              </p>
            </div>
          ) : (
            <button type="button" className={ghostButtonClass} onClick={() => setSecondGymOpen(true)}>
              + Add a second gym — show it as “either”
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field label="From" htmlFor="session-start">
                <Select
                  id="session-start"
                  value={startKind}
                  onChange={(event) => setStartKind(event.target.value)}
                >
                  <option value={EXACT_TIME}>Specific time…</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {startIsExact ? (
                <input
                  id="session-start-time"
                  type="time"
                  aria-label="From time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              ) : null}
            </div>

            <div>
              <Field label="To" htmlFor="session-end">
                <Select
                  id="session-end"
                  value={endKind}
                  onChange={(event) => setEndKind(event.target.value)}
                >
                  <option value={EXACT_TIME}>Specific time…</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.label} value={slot.label}>
                      {slot.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {endIsExact ? (
                <input
                  id="session-end-time"
                  type="time"
                  aria-label="To time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              ) : null}
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Pick a specific time, or a time of day like “Opening” or “After Dinner”.
          </p>

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
