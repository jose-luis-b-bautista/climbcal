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
  textareaClass,
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

    // Feedback form state
  const [feedbackType, setFeedbackType] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackSent, setFeedbackSent] = useState(false)

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

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFeedbackError(null)

    if (!userId) {
      setFeedbackError('You need to be signed in.')
      return
    }

    if (!feedbackMessage.trim()) {
      setFeedbackError('Please write something before submitting.')
      return
    }

    setSubmittingFeedback(true)
    const { error: feedbackError } = await supabase.from('feedback').insert({
      user_id: userId,
      feedback_type: feedbackType || null,
      message: feedbackMessage.trim(),
      status: 'new',
      admin_notes: null,
    })
    setSubmittingFeedback(false)

    if (feedbackError) {
      setFeedbackError(feedbackError.message)
      return
    }

    setFeedbackMessage('')
    setFeedbackType('')
    setFeedbackSent(true)
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
        <SectionHeading
          title="Feedback"
          hint="Help us improve climbcal — send us your thoughts, bug reports, or feature ideas."
        />

        {feedbackError ? <ErrorBanner message={feedbackError} onDismiss={() => setFeedbackError(null)} /> : null}
        {feedbackSent ? <Notice tone="success">Thanks — we'll get back to you.</Notice> : null}

        <form onSubmit={handleFeedbackSubmit} className="mt-3 space-y-4">
          <Field label="Category" htmlFor="settings-feedback-type">
            <select
              id="settings-feedback-type"
              value={feedbackType}
              onChange={(event) => setFeedbackType(event.target.value)}
              className={inputClass}
            >
              <option value="">General</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature request</option>
              <option value="ux">UX / usability</option>
            </select>
          </Field>

          <Field label="Message" htmlFor="settings-feedback-message">
            <textarea
              id="settings-feedback-message"
              rows={4}
              required
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Tell us what's on your mind…"
              className={textareaClass}
            />
          </Field>

          <button type="submit" disabled={submittingFeedback || !feedbackMessage.trim()} className={primaryButtonClass}>
            {submittingFeedback ? 'Sending…' : 'Send feedback'}
          </button>
        </form>
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
