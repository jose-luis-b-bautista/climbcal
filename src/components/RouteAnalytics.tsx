import { Analytics } from '@vercel/analytics/react'
import { useLocation } from 'react-router-dom'

/**
 * Vercel Web Analytics: cookieless pageviews, no personal data.
 *
 * Mounted from `main.tsx` (not inside `App`) so tests, which render `<App />`
 * directly, never inject the script. Passing `route` is what makes a
 * client-side navigation count as a pageview rather than only the first load.
 * `mode` stays on the default `auto`, which resolves to `development` under
 * `vite dev` (console only) and `production` in a build.
 *
 * Reads the router context, so it has to sit inside the `<BrowserRouter>`.
 */
export function RouteAnalytics() {
  const { pathname } = useLocation()
  return <Analytics route={pathname} />
}
