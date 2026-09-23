/**
 * The stats views exist twice: as SQL in
 * `supabase/migrations/20260923000000_stats_views.sql` and as row types in
 * `src/types.ts`. Nothing imports both, and a missing row type only shows up as
 * an `undefined` at runtime, so this test reads the two files and fails when they
 * drift — the same trick `slots.test.ts` uses on the window migration.
 *
 * It also guards the two labels that are duplicated in SQL on purpose: the
 * unnamed-gym bucket (`gymNameOf`) and the untagged-region bucket
 * (`OTHER_REGION_LABEL`).
 */
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OTHER_REGION_LABEL, gymNameOf } from './format'

// Paths are relative to the project root, the working directory for `npm test`.
const migration = readFileSync(
  resolvePath(process.cwd(), 'supabase/migrations/20260923000000_stats_views.sql'),
  'utf8',
)
const types = readFileSync(resolvePath(process.cwd(), 'src/types.ts'), 'utf8')

const viewNames = [...migration.matchAll(/create or replace view public\.(\w+)/g)].map(
  (match) => match[1],
)

/** The `Views:` keys declared in types.ts, between `Views: {` and `Functions: {`. */
function declaredViewNames(source: string): string[] {
  const block = source.slice(source.indexOf('Views: {'), source.indexOf('Functions: {'))
  return [...block.matchAll(/^ {6}(\w+): \{/gm)].map((match) => match[1])
}

describe('stats views migration', () => {
  it('defines the five v1 views', () => {
    expect(viewNames).toEqual([
      'climb_sessions',
      'climb_gyms',
      'climber_daily_activity',
      'climber_totals',
      'climber_gym_stats',
    ])
  })

  it('binds every view to the reader’s RLS and grants it to authenticated', () => {
    for (const name of viewNames) {
      const start = migration.indexOf(`create or replace view public.${name}`)
      const body = migration.slice(start, migration.indexOf(';', start))

      // A view owned by the table owner would read `climbs` past RLS and hand
      // every climber every row, so each definition has to opt back in.
      expect(body, `${name} is missing security_invoker`).toContain(
        'with (security_invoker = true) as',
      )
      // init.sql grants per table, so an ungraded view is invisible to clients.
      expect(migration, `${name} is not granted to authenticated`).toContain(
        `grant select on public.${name} to authenticated;`,
      )
    }
  })

  it('declares a row type in types.ts for every view', () => {
    expect(declaredViewNames(types)).toEqual(viewNames)
  })

  it('drops the views in reverse order before recreating them', () => {
    const drops = [...migration.matchAll(/drop view if exists public\.(\w+)/g)].map(
      (match) => match[1],
    )
    // Dependents first, so re-running the migration never trips over a view that
    // is still referenced.
    expect(drops).toEqual([...viewNames].reverse())
  })

  it('reuses the app’s labels for an unnamed gym and an untagged region', () => {
    expect(migration).toContain(`'${gymNameOf({})}'`)
    expect(migration).toContain(`'${OTHER_REGION_LABEL}'`)
  })
})
