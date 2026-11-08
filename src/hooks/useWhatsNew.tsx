/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// This module intentionally exports both <WhatsNewProvider> and useWhatsNew().
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { WHATS_NEW_LATEST, WHATS_NEW_STORAGE_KEY } from '../lib/whatsNew'

interface WhatsNewContextValue {
  /** True while the release-notes dialog should be on screen. */
  open: boolean
  /** Opens it by hand - the Settings card's "Show what was updated". */
  show: () => void
  /** Closes it and records this release as read, so it stays closed. */
  dismiss: () => void
}

const WhatsNewContext = createContext<WhatsNewContextValue | undefined>(undefined)

/** The release id already read on this device, or null on a first visit. */
function readSeen(): string | null {
  try {
    return window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)
  } catch {
    // localStorage can throw (private mode); treat it as "not read yet".
    return null
  }
}

/**
 * Remembers which release notes have been read, per device.
 *
 * It starts **open** whenever the stored id is not the current release, which is
 * what makes the pop-up appear once after a deploy - and mark itself read on any
 * close (the × / the backdrop / Escape / "Got it" all land here).
 */
export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => readSeen() !== WHATS_NEW_LATEST.id)

  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_LATEST.id)
    } catch {
      // Ignore storage failures: the notes simply show again next visit.
    }
  }, [])

  const show = useCallback(() => setOpen(true), [])

  const value = useMemo(() => ({ open, show, dismiss }), [open, show, dismiss])

  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>
}

export function useWhatsNew(): WhatsNewContextValue {
  const context = useContext(WhatsNewContext)
  if (!context) throw new Error('useWhatsNew must be used inside <WhatsNewProvider>')
  return context
}
