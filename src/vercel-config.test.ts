/**
 * Vercel fails the whole deployment - not just a warning - when a `source` in
 * `vercel.json` is not a pathname. The error is "Invalid route source pattern"
 * (https://vercel.link/invalid-route-source-pattern): `source` is compiled with
 * path-to-regexp, so a full URL throws "Missing parameter name" while the deploy
 * is being created. A hostname belongs in `has`, not in `source`.
 *
 * That failure never shows up in lint/test/build, which is exactly why the
 * config is asserted here.
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'

type Route = {
  source: string
  destination?: unknown
  has?: { type: string; value?: string }[]
}

const config = JSON.parse(
  readFileSync(resolvePath(process.cwd(), 'vercel.json'), 'utf8'),
) as { redirects?: Route[]; rewrites?: Route[] }

const routes: Route[] = [...(config.redirects ?? []), ...(config.rewrites ?? [])]

describe('vercel.json', () => {
  it('keeps the SPA fallback, so deep links work on refresh', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('uses pathnames for every source', () => {
    // path-to-regexp compiles `/(.*)` but throws on `https://…`; a hostname in
    // `source` is the "Invalid route source pattern" failure.
    for (const route of routes) {
      expect(route.source.startsWith('/')).toBe(true)
      expect(route.source).not.toContain('://')
    }
  })

  it('sends the vercel.app hostname to climbcal.app via has, not via source', () => {
    expect(config.redirects).toHaveLength(1)

    const [redirect] = config.redirects ?? []
    expect(redirect.source).toBe('/:path*')
    expect(redirect.destination).toBe('https://climbcal.app/:path*')
    // The host value is a regex, so the dots are escaped (as Vercel's docs do).
    expect(redirect.has).toEqual([{ type: 'host', value: 'climbcal\\.vercel\\.app' }])
  })
})
