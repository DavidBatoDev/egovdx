import { NextResponse, type NextRequest } from 'next/server'
import { checkPayment } from '@/lib/egov/pay'
import { recordEvent } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'

/** eGOV PAY calls this on any transaction state change. The gateway remains authoritative. */
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Record<string, unknown>
    const data = (payload.data ?? payload) as Record<string, unknown>
    const uuid = String(data.uuid ?? data.transaction_uuid ?? '').trim()
    if (!uuid) return NextResponse.json({ error: 'Missing payment UUID.' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: request, error } = await db
      .from('requests')
      .select('id, fee_status')
      .eq('payment_uuid', uuid)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!request) {
      console.warn(`[pay:callback] received unknown payment UUID ${uuid}`)
      return NextResponse.json({ received: true })
    }

    const result = await checkPayment(uuid)
    if (result.data.status === 'paid' && request.fee_status !== 'paid') {
      const { error: updateError } = await db
        .from('requests')
        .update({ fee_status: 'paid', payment_ref: result.data.referenceNumber })
        .eq('id', request.id)
      if (updateError) throw new Error(updateError.message)
    }

    await recordEvent(request.id, 'system', 'payment_status_checked', {
      payment_uuid: uuid,
      payment_status: result.data.status,
      payment_reference: result.data.referenceNumber,
      source: result.source,
    })
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[pay:callback]', err)
    return NextResponse.json({ error: 'Could not reconcile payment callback.' }, { status: 500 })
  }
}
