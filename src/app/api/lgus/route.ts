import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getPsgcEntry } from '@/lib/psgc'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const officer = await requireRole('officer')
    const body = (await req.json()) as { psgcCode?: string; officialEmail?: string }
    const psgcCode = body.psgcCode?.trim() ?? ''
    const officialEmail = body.officialEmail?.trim().toLowerCase() ?? ''

    if (!psgcCode) return NextResponse.json({ error: 'Select an LGU from the PSA reference.' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) {
      return NextResponse.json({ error: 'Enter a valid official email address.' }, { status: 400 })
    }

    const entry = await getPsgcEntry(psgcCode)
    if (!entry || !['municipality', 'city', 'barangay'].includes(entry.level)) {
      return NextResponse.json({ error: 'That PSA location cannot be registered as an LGU.' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const { data: existing, error: existingError } = await db
      .from('lgus')
      .select('id, name')
      .eq('psgc_code', entry.code)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) {
      return NextResponse.json(
        { error: `${existing.name} is already registered.`, lguId: existing.id },
        { status: 409 },
      )
    }

    const { data: lgu, error } = await db
      .from('lgus')
      .insert({
        name: entry.name,
        type:
          entry.level === 'city'
            ? 'city'
            : entry.level === 'municipality'
              ? 'municipality'
              : 'barangay',
        region: entry.region_code,
        psgc_code: entry.code,
        official_email: officialEmail,
        registered_by: officer.sub,
        registered_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ id: lgu.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not register the LGU.' : message }, { status })
  }
}
