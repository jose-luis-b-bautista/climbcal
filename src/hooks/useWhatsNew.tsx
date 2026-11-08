/* oxlint-disable react/only-export-components, react-refresh/only-export-components */
// This module intentionally exports both <WhatsNewProvider> and useWhatsNew().
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  WHATS_NEW_LATEST,
  WHATS_NEW_STORAGE_KEY,
  unreadWhatsNew,
  type WhatsNewEntry,
} from '../lib/whatsNew'

interface WhatsNewContextValue {
  /** True while the release-notes dialog should be on screen. */
  open: boolean
  /** The releases to render, newest first. Empty while closed. */
  entries: WhatsNewEntry[]
  /** Opens it by hand - the Settings card's "Show what was updated". */
  show: () => void
  /** Closes it and records the newest release as read, so it stays closed. */
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
 * It starts **open** whenever there are releases newer than the stored marker,
 * and shows all of them in one dialog - skipping a deploy does not lose a
 * release. Any close (× / backdrop / Escape / "Got it") records the newest id, so
 * the next visit is quiet. A device that is fully up to date holds no entries at
 * all, which is also the closed state.
 */
export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WhatsNewEntry[]>(() => unreadWhatsNew(readSeen()))

  const dismiss = useCallback(() => {
    setEntries([])
    try {
      window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_LATEST.id)
    } catch {
      // Ignore storage failures: the notes simply show again next visit.
    }
  }, [])

  const show = useCallback(() => setEntries([WHATS_NEW_LATEST]), [])

  const value = useMemo(
    () => ({ open: entries.length > 0, entries, show, dismiss }),
    [entries, show, dismiss],
  )

  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>
}

export function useWhatsNew(): WhatsNewContextValue {
  const context = useContext(WhatsNewContext)
  if (!context) throw new Error('useWhatsNew must be used inside <WhatsNewProvider>')
  return context
}
