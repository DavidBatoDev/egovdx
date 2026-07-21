import 'server-only'
import { supabaseAdmin } from './supabase/server'
import type { PsgcEntry } from './supabase/types'

/**
 * Search the locally-seeded PSA geographic reference. This intentionally does
 * not hard-code demo LGUs: a selected record carries the PSGC code that the
 * registration route persists and can safely de-duplicate on.
 */
export async function searchPsgc(query: string): Promise<PsgcEntry[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const { data, error } = await supabaseAdmin()
    .from('psgc_reference')
    .select('*')
    .in('level', ['municipality', 'city', 'barangay'])
    .ilike('name', `%${term.replace(/[%_]/g, '\\$&')}%`)
    .order('level', { ascending: true })
    .order('name', { ascending: true })
    .limit(20)

  if (error) throw new Error(`searchPsgc: ${error.message}`)
  return data ?? []
}

export async function getPsgcEntry(code: string): Promise<PsgcEntry | null> {
  const { data, error } = await supabaseAdmin()
    .from('psgc_reference')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (error) throw new Error(`getPsgcEntry: ${error.message}`)
  return data ?? null
}
