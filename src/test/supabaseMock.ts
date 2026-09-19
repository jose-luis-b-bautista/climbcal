/**
 * Minimal stand-in for the Supabase JS client used in tests: a chainable query
 * builder that records filters and delegates the result to a resolver. It is
 * promise-like (`then`), which is what `await supabase.from(...).select('*')`
 * relies on.
 */
import type { Session } from '@supabase/supabase-js'

export type MockQueryOp = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

export interface MockQueryContext {
  table: string
  /** Filters keyed by column; `in.<column>` for `.in()`, etc. */
  filters: Record<string, unknown>
  op: MockQueryOp
}

export interface MockResult {
  data: unknown
  error: { message: string; code?: string } | null
}

export type MockResolver = (context: MockQueryContext) => MockResult

interface QueryBuilder {
  select: (columns?: string) => QueryBuilder
  insert: (values: unknown) => QueryBuilder
  update: (values: unknown) => QueryBuilder
  upsert: (values: unknown, options?: unknown) => QueryBuilder
  delete: () => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  neq: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown) => QueryBuilder
  ilike: (column: string, pattern: string) => QueryBuilder
  not: (column: string, operator: string, value: unknown) => QueryBuilder
  or: (filter: string) => QueryBuilder
  gte: (column: string, value: unknown) => QueryBuilder
  lte: (column: string, value: unknown) => QueryBuilder
  order: (column: string, options?: unknown) => QueryBuilder
  limit: (count: number) => QueryBuilder
  single: () => Promise<MockResult>
  maybeSingle: () => Promise<MockResult>
  then: <TResult1 = MockResult, TResult2 = never>(
    onFulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>
}

export interface MockSupabaseClient {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: null }>
    onAuthStateChange: (callback: unknown) => { data: { subscription: { unsubscribe: () => void } } }
    signOut: () => Promise<{ error: null }>
  }
  from: (table: string) => QueryBuilder
}

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

/** A session shaped like the one Supabase returns for TEST_USER_ID. */
export function makeTestSession(): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: TEST_USER_ID,
      email: 'luis@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as Session
}

export function createSupabaseMock(
  resolver: MockResolver,
  session: Session | null = makeTestSession(),
): MockSupabaseClient {
  const buildQuery = (table: string): QueryBuilder => {
    const filters: Record<string, unknown> = {}
    let op: MockQueryOp = 'select'

    const context = (): MockQueryContext => ({ table, filters, op })

    const builder: QueryBuilder = {
      select: () => builder,
      insert: (values) => {
        op = 'insert'
        filters.__values = values
        return builder
      },
      update: (values) => {
        op = 'update'
        filters.__values = values
        return builder
      },
      upsert: (values) => {
        op = 'upsert'
        filters.__values = values
        return builder
      },
      delete: () => {
        op = 'delete'
        return builder
      },
      eq: (column, value) => {
        filters[column] = value
        return builder
      },
      neq: (column, value) => {
        filters[`neq.${column}`] = value
        return builder
      },
      in: (column, values) => {
        filters[`in.${column}`] = values
        return builder
      },
      ilike: (column, pattern) => {
        filters[`ilike.${column}`] = pattern
        return builder
      },
      not: (column, operator, value) => {
        filters[`not.${column}`] = [operator, value]
        return builder
      },
      or: (filter) => {
        filters.__or = filter
        return builder
      },
      gte: (column, value) => {
        filters[`gte.${column}`] = value
        return builder
      },
      lte: (column, value) => {
        filters[`lte.${column}`] = value
        return builder
      },
      order: (column, options) => {
        filters.__order = [column, options]
        return builder
      },
      limit: (count) => {
        filters.__limit = count
        return builder
      },
      single: async () => resolver(context()),
      maybeSingle: async () => resolver(context()),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(resolver(context())).then(onFulfilled, onRejected),
    }

    return builder
  }

  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => buildQuery(table),
  }
}
