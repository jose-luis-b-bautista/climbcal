import { useState } from 'react'
import { cx, inputClass, secondaryButtonClass } from './ui'

/**
 * "Share link" control for a public profile URL.
 *
 * Phones get the native sheet (`navigator.share`, so the link can go straight to
 * WhatsApp); everywhere else the link is copied to the clipboard. Both can be
 * unavailable — an insecure origin, a browser without the API — so the URL is
 * always shown next to the button: copying is a convenience, never the only way
 * to get the link.
 */
export function ShareLink({ path, label = 'Share link' }: { path: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const url = `${window.location.origin}${path}`

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: 'climbcal' })
        return
      } catch {
        // Dismissed, or the URL is not shareable — fall through to the clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Profile link"
          // Selecting on focus is the manual escape hatch when neither API works.
          onFocus={(event) => event.currentTarget.select()}
          className={cx(inputClass, 'w-full sm:w-auto sm:min-w-0 sm:flex-1')}
        />
        <button type="button" className={secondaryButtonClass} onClick={() => void share()}>
          {status === 'copied' ? 'Copied' : label}
        </button>
      </div>
      {status === 'failed' ? (
        <p className="text-xs text-red-300">
          Could not copy automatically — select the link above instead.
        </p>
      ) : null}
    </div>
  )
}
