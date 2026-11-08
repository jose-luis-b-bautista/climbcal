import { useEffect } from 'react'
import type { WhatsNewEntry } from '../lib/whatsNew'
import { primaryButtonClass } from './ui'

/**
 * "What was updated" sheet: the newest release notes, shown once per release.
 *
 * Same shape as the session dialog (bottom sheet on a phone, centred card from
 * `sm` up), and it closes on the × / the backdrop / Escape / "Got it" - every one
 * of which the provider treats as "read".
 */
export function WhatsNewDialog({
  entry,
  onClose,
}: {
  entry: WhatsNewEntry
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      // The backdrop dismisses; the sheet below stops the click from reaching it.
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="whats-new-title" className="text-lg font-semibold text-zinc-100">
              What was updated
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{entry.date}</p>
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

        <ul className="mt-4 space-y-2.5">
          {entry.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2 text-sm text-zinc-300">
              <span aria-hidden="true" className="mt-0.5 text-emerald-400">
                •
              </span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

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
