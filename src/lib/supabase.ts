import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both Vite env vars are present. The UI shows a setup hint instead
 * of failing with opaque network errors.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    '[climbcal] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env.local and paste your Supabase project values.',
  )
}

/**
 * Placeholders keep `createClient` from throwing at import time so the app can
 * still render the "finish setup" screen. Requests will fail until real values
 * are provided. The anon key is a public, RLS-protected key: safe in the client.
 */
export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
