/**
 * The "what was updated" pop-up: the copy it shows, every way out of it, and the
 * once-per-release rule (a device that has read this id does not see it again,
 * but the Settings card can still bring it back).
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WhatsNewProvider, useWhatsNew } from '../hooks/useWhatsNew'
import { WHATS_NEW, WHATS_NEW_LATEST, WHATS_NEW_STORAGE_KEY } from '../lib/whatsNew'
import { WhatsNewDialog } from './WhatsNewDialog'

describe('<WhatsNewDialog />', () => {
  it('shows the release copy and closes from every exit', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog entries={[WHATS_NEW_LATEST]} onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'What was updated' })
    expect(within(dialog).getByText(WHATS_NEW_LATEST.date)).toBeTruthy()
    for (const highlight of WHATS_NEW_LATEST.highlights) {
      expect(within(dialog).getByText(highlight)).toBeTruthy()
    }

    // "Got it" is the expected way out, and it starts focused.
    const gotIt = within(dialog).getByRole('button', { name: 'Got it' })
    expect(document.activeElement).toBe(gotIt)
    fireEvent.click(gotIt)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)

    // The sheet swallows the click; the backdrop behind it dismisses.
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(3)
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(4)
  })

  it('stacks every unread release, newest first', () => {
    render(<WhatsNewDialog entries={WHATS_NEW} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'What was updated' })
    expect(
      within(dialog).getByText(new RegExp(`everything since your last visit`, 'i')),
    ).toBeTruthy()
    expect(within(dialog).getByText(`${WHATS_NEW.length} releases.`, { exact: false })).toBeTruthy()

    for (const entry of WHATS_NEW) {
      expect(within(dialog).getByText(entry.date)).toBeTruthy()
      for (const highlight of entry.highlights) {
        expect(within(dialog).getByText(highlight)).toBeTruthy()
      }
    }
  })

  it('renders nothing when there is nothing unread', () => {
    render(<WhatsNewDialog entries={[]} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

/** Minimal consumer: the provider's state without the whole app behind it. */
function Probe() {
  const { open, entries, show, dismiss } = useWhatsNew()
  return (
    <div>
      <span>{open ? 'notes open' : 'notes closed'}</span>
      <span>{`count ${entries.length}`}</span>
      <button type="button" onClick={show}>
        show
      </button>
      <button type="button" onClick={dismiss}>
        dismiss
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <WhatsNewProvider>
      <Probe />
    </WhatsNewProvider>,
  )
}

describe('<WhatsNewProvider />', () => {
  it('opens on every unread release and records them on dismiss', () => {
    // The test setup marks releases read; a first visit has no key at all.
    window.localStorage.removeItem(WHATS_NEW_STORAGE_KEY)
    renderProbe()

    expect(screen.getByText('notes open')).toBeTruthy()
    // Nothing is known to be read, so the whole shipped list is unread.
    expect(screen.getByText(`count ${WHATS_NEW.length}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(screen.getByText('notes closed')).toBeTruthy()
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_LATEST.id)
  })

  it('stays closed once read, and the Settings card can reopen it', () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_LATEST.id)
    renderProbe()

    expect(screen.getByText('notes closed')).toBeTruthy()

    // Showing it by hand does not un-read the release…
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    expect(screen.getByText('notes open')).toBeTruthy()
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_LATEST.id)
  })

  it('opens again for a release the device has not read', () => {
    // A marker the client no longer ships - we cannot tell what was read, so
    // everything is treated as unread rather than silently dropping releases.
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, '2020-01-01-older-release')
    renderProbe()

    expect(screen.getByText('notes open')).toBeTruthy()
    expect(screen.getByText(`count ${WHATS_NEW.length}`)).toBeTruthy()
  })

  it('shows every release newer than the last one read', () => {
    // An older known release: only what sits above it is unread.
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW[1].id)
    renderProbe()

    expect(screen.getByText('notes open')).toBeTruthy()
    expect(screen.getByText('count 1')).toBeTruthy()

    // Dismissing marks the whole batch read, from the newest end.
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(screen.getByText('notes closed')).toBeTruthy()
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_LATEST.id)
  })
})
