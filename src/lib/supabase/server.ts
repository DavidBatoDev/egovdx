import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Server-only Supabase client using the service role key.
 *
 * RLS is disabled on this project (see supabase/schema.sql) — every read and
 * write is expected to come through a Next.js route handler or server
 * component, never from the browser. Importing this into a client component
 * would leak the service role key, so it throws loudly if that happens.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Copy .env.local.template to .env.local and fill it in.',
    )
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
