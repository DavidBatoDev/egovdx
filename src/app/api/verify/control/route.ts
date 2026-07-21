import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/** GET /api/verify/control?cn=BRGY-2026-000001 → redirect to /verify/<requestId> */
export async function GET(req: NextRequest) {
  const cn = req.nextUrl.searchParams.get('cn')
  if (!cn) return NextResponse.json({ error: 'cn required' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('requests')
    .select('id')
    .eq('control_number', cn)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.redirect(
      new URL(`/verify?error=${encodeURIComponent(`No document found for control number ${cn}`)}`, req.url),
    )
  }

  return NextResponse.redirect(new URL(`/verify/${data.id}`, req.url))
}
