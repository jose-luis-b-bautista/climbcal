import { useEffect, useId } from 'react'
import type { WhatsNewEntry } from '../lib/whatsNew'
import { primaryButtonClass } from './ui'

/**
 * "What was updated" sheet: every release this device has not read yet, newest
 * first. Same shape as the session dialog (bottom sheet on a phone, centred card
 * from `sm` up), and it closes on the × / the backdrop / Escape / "Got it" -
 * every one of which the provider treats as "read".
 *
 * One release renders as a single date line under the title; several render as a
 * section each, so a deploy that skipped a week still reads as separate releases.
 */
export function WhatsNewDialog({
  entries,
  onClose,
}: {
  entries: WhatsNewEntry[]
  onClose: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (entries.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      // The backdrop dismisses; the sheet below stops the click from reaching it.
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
              What was updated
            </h2>
            {entries.length > 1 ? (
              <p className="mt-0.5 text-xs text-zinc-500">
                Everything since your last visit - {entries.length} releases.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-xl leading-none text-zinc-400 hover:text-zinc-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={entries.length > 1 ? 'mt-4 space-y-5' : 'mt-4 space-y-2.5'}>
          {entries.map((entry) => (
            <section key={entry.id} aria-label={entry.date}>
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {entry.date}
              </p>
              <ul className="mt-2 space-y-2.5">
                {entry.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-sm text-zinc-300">
                    <span aria-hidden="true" className="mt-0.5 text-emerald-400">
                      •
                    </span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          {/* Focus lands here, so Enter (or Space) dismisses without hunting. */}
          <button type="button" onClick={onClose} className={primaryButtonClass} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
