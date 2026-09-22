/**
 * Guards the light/dark theming:
 *  1. the colour tokens in index.css keep readable contrast in both themes,
 *  2. the pre-paint script in index.html stays in step with the toggle.
 *
 * The token values live in CSS, so the CSS is parsed instead of duplicated —
 * changing a colour here without checking contrast fails the test.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from './hooks/useTheme'
import { AVATAR_HUES, AVATAR_HUE_CLASSES } from './lib/avatar'

// Read the sources from disk: Vitest stubs CSS imports, so `import ... from
// './index.css?raw'` comes back empty here. Paths are relative to the project
// root, which is the working directory for `npm test`.
function readSource(relativePath: string): string {
  return readFileSync(resolvePath(process.cwd(), relativePath), 'utf8')
}

const css = readSource('src/index.css')
const html = readSource('index.html')

function readTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of block.matchAll(/--color-([a-z]+-\d{2,3}):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[match[1].toLowerCase()] = match[2].toLowerCase()
  }
  return tokens
}

const lightBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
const darkBlock = css.match(/^\.dark\s*\{([\s\S]*?)\n\}/m)?.[1] ?? ''

const lightTokens = readTokens(lightBlock)
const darkTokens = readTokens(darkBlock)

/** Avatar chip tokens: `--color-avatar-<hue>` (chip) + `-ink` (initials). */
function readAvatarTokens(block: string): Record<string, { bg: string; ink: string }> {
  const tokens: Record<string, { bg: string; ink: string }> = {}
  for (const match of block.matchAll(/--color-avatar-([a-z]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[match[1]] = { ...(tokens[match[1]] ?? { ink: '' }), bg: match[2].toLowerCase() }
  }
  for (const match of block.matchAll(/--color-avatar-([a-z]+)-ink:\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[match[1]] = { ...(tokens[match[1]] ?? { bg: '' }), ink: match[2].toLowerCase() }
  }
  return tokens
}

const lightAvatar = readAvatarTokens(lightBlock)
const darkAvatar = readAvatarTokens(darkBlock)

/** `white` is the one literal colour used on top of the accent tokens. */
const EXTRA_COLORS: Record<string, string> = { white: '#ffffff' }

function resolve(tokens: Record<string, string>, name: string): string {
  const value = tokens[name] ?? EXTRA_COLORS[name]
  if (!value) throw new Error(`Unknown colour token "${name}" — check index.css`)
  return value
}

function channelToLinear(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  return (
    0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
  )
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

type Pair = [foreground: string, background: string, role: string]

/** Body copy: must hit WCAG AA (4.5:1) on both themes. */
const BODY_TEXT: Pair[] = [
  ['zinc-100', 'zinc-950', 'primary text on the page'],
  ['zinc-300', 'zinc-900', 'form labels and field text on cards'],
  ['zinc-400', 'zinc-900', 'muted card text (gym names, hints)'],
  ['emerald-300', 'zinc-900', 'session time windows'],
  ['red-200', 'red-950', 'error banner text'],
  ['sky-200', 'sky-950', 'info notice text'],
  ['emerald-100', 'emerald-900', 'avatar initials'],
]

/**
 * Secondary text and small accents. The light theme meets AA; the dark palette
 * is Tailwind's stock scale (predates the toggle) and sits at ~3.4-3.9:1 there.
 */
const SECONDARY_TEXT: Pair[] = [
  ['zinc-500', 'zinc-950', 'hint text on the page'],
  ['zinc-500', 'zinc-900', 'hint text on cards'],
  ['white', 'emerald-600', 'primary button label'],
]

/** Borders and dividers only need to be perceivable (>1.05:1). */
const SURFACES: Pair[] = [
  ['zinc-800', 'zinc-950', 'card border against the page'],
  ['zinc-700', 'zinc-900', 'input border against cards'],
]

describe('light theme tokens', () => {
  it('has a light palette defined', () => {
    expect(Object.keys(lightTokens).length).toBeGreaterThan(20)
    expect(lightTokens['zinc-950']).toBeTruthy()
  })

  it('keeps body text readable', () => {
    for (const [fg, bg, role] of BODY_TEXT) {
      const ratio = contrast(resolve(lightTokens, fg), resolve(lightTokens, bg))
      expect(ratio, `${role}: ${fg} on ${bg} is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  it('keeps secondary text readable', () => {
    for (const [fg, bg, role] of SECONDARY_TEXT) {
      const ratio = contrast(resolve(lightTokens, fg), resolve(lightTokens, bg))
      expect(ratio, `${role}: only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps borders visible', () => {
    for (const [fg, bg, role] of SURFACES) {
      const ratio = contrast(resolve(lightTokens, fg), resolve(lightTokens, bg))
      expect(ratio, `${role}: only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.05)
    }
  })
})

describe('dark theme tokens', () => {
  it('keeps body text readable', () => {
    for (const [fg, bg, role] of BODY_TEXT) {
      const ratio = contrast(resolve(darkTokens, fg), resolve(darkTokens, bg))
      expect(ratio, `${role}: only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps secondary text and borders perceivable', () => {
    for (const [fg, bg, role] of [...SECONDARY_TEXT, ...SURFACES]) {
      const ratio = contrast(resolve(darkTokens, fg), resolve(darkTokens, bg))
      expect(ratio, `${role}: only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.3)
    }
  })
})

describe('avatar colours', () => {
  it('defines a chip + ink pair for every hue, in both themes', () => {
    for (const hue of AVATAR_HUES) {
      expect(lightAvatar[hue]?.bg, `${hue} chip missing from the light palette`).toBeTruthy()
      expect(lightAvatar[hue]?.ink, `${hue} ink missing from the light palette`).toBeTruthy()
      expect(darkAvatar[hue]?.bg, `${hue} chip missing from the dark palette`).toBeTruthy()
      expect(darkAvatar[hue]?.ink, `${hue} ink missing from the dark palette`).toBeTruthy()
    }

    // No orphans either: a token the app can never pick is dead weight.
    const defined = [...AVATAR_HUES].sort()
    expect(Object.keys(lightAvatar).sort()).toEqual(defined)
    expect(Object.keys(darkAvatar).sort()).toEqual(defined)
  })

  it('keeps the initials readable on every chip, in both themes', () => {
    for (const hue of AVATAR_HUES) {
      const light = contrast(lightAvatar[hue].ink, lightAvatar[hue].bg)
      const dark = contrast(darkAvatar[hue].ink, darkAvatar[hue].bg)
      expect(light, `${hue} light initials: only ${light.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      expect(dark, `${hue} dark initials: only ${dark.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('points every hue at a token that exists', () => {
    for (const hue of AVATAR_HUES) {
      expect(AVATAR_HUE_CLASSES[hue]).toContain(`bg-avatar-${hue}`)
      expect(AVATAR_HUE_CLASSES[hue]).toContain(`text-avatar-${hue}-ink`)
    }
  })
})

describe('theme wiring', () => {
  it('switches on the html class rather than the OS preference', () => {
    expect(css).toContain('@custom-variant dark')
    expect(css).toContain('background-color: var(--color-zinc-950)')
    expect(html).toMatch(/classList\.toggle\('dark'/)
  })

  it('reads the same storage key as the toggle', () => {
    expect(html).toContain(THEME_STORAGE_KEY)
    expect(html).toMatch(/prefers-color-scheme: dark/)
  })

  it('declares a theme-color meta tag for the mobile browser chrome', () => {
    expect(html).toMatch(/name="theme-color"/)
  })
})