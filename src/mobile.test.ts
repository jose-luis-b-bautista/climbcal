/**
 * Guards the mobile behaviour that lives in the markup and the stylesheet:
 *
 *  1. iOS Safari zooms the page whenever a focused form control renders below
 *     16px — tapping the search bar (or any session field) blew the layout up.
 *     index.css sizes form controls at a hard 16px for touch pointers.
 *  2. The viewport meta must keep letting people pinch-zoom; `maximum-scale`
 *     would be the wrong way to stop the focus zoom.
 *
 * Vitest stubs CSS imports, so the sources are read from disk — the same trick
 * as in theme.test.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(resolvePath(process.cwd(), relativePath), 'utf8')
}

const css = readSource('src/index.css')
const html = readSource('index.html')

/** Body of the touch-pointer block that guards against the iOS focus zoom. */
const touchFormControls =
  css.match(/@media \(hover: none\) and \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

describe('mobile form controls', () => {
  it('renders form controls at 16px for touch pointers', () => {
    expect(touchFormControls, 'no touch-pointer rule found in index.css').toContain(
      'font-size: 16px',
    )
  })

  it('covers every field that can be focused on a phone', () => {
    for (const control of ['input', 'select', 'textarea']) {
      expect(touchFormControls, `${control} is missing from the zoom guard`).toContain(control)
    }
  })
})

describe('viewport meta', () => {
  it('scales to the device width without blocking pinch-zoom', () => {
    expect(html).toMatch(/name="viewport"[^>]*width=device-width/)
    expect(html).toMatch(/initial-scale=1/)
    expect(html).not.toContain('maximum-scale')
    expect(html).not.toContain('user-scalable')
  })
})
