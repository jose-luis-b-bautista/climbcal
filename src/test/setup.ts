import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { WHATS_NEW_LATEST, WHATS_NEW_STORAGE_KEY } from '../lib/whatsNew'

/**
 * jsdom's Storage is shadowed by Node's experimental `localStorage` global, which
 * can come up as a broken empty object (Node prints a `--localstorage-file`
 * warning in that case). Install a small in-memory implementation so the theme
 * tests exercise the same code path a browser does, in any environment.
 */
function installInMemoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  } as Storage

  for (const target of new Set<object>([globalThis, window])) {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })
  }
}

installInMemoryStorage()

beforeEach(() => {
  // Release notes are page chrome: every test starts with the current release
  // already read, so the pop-up never sits in front of the page under test. The
  // what's-new tests remove the key to see it (src/components/WhatsNew.test.tsx).
  window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_LATEST.id)
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})
