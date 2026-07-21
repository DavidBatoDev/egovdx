import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import { getRequest, recordEvent } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('officer')
    const { id } = await ctx.params
    const body = (await req.json()) as { note?: string }
    const note = body.note?.trim() ?? ''
    if (!note) return NextResponse.json({ error: 'A rejection note is required.' }, { status: 422 })
    const request = await getRequest(id)
    if (!request) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    const { data: officer } = await supabaseAdmin().from('officers').select('lgu_id, office').eq('egov_sub', session.sub).eq('role', 'officer').maybeSingle()
    if (!officer || officer.lgu_id !== request.service.lgu_id) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    if (officer.office && officer.office.toLowerCase() !== (request.service.approval_office ?? '').toLowerCase()) return NextResponse.json({ error: 'WRONG_OFFICE' }, { status: 403 })
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin().from('requests').update({ status: 'rejected', rejected_by: session.sub, rejected_at: now, rejection_note: note }).eq('id', id).eq('status', 'submitted').select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Request is no longer rejectable.' }, { status: 409 })
    await recordEvent(id, `officer:${session.sub}`, 'rejected', { note })
    return NextResponse.json({ id, status: 'rejected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500 })
  }
}
