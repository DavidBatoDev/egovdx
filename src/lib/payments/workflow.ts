import 'server-only'
import { getRequest, recordEvent } from '@/lib/data'
import { checkPayment, generatePayment } from '@/lib/egov/pay'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { EgovSource } from '@/lib/egov/client'

export type PaymentState = {
  requestId: string
  feeDue: number
  feeStatus: 'unpaid' | 'waived' | 'paid'
  waiverApplied: string | null
  checkoutUrl: string | null
  paymentReference: string | null
  source: EgovSource | null
}

function state(request: NonNullable<Awaited<ReturnType<typeof getRequest>>>): PaymentState {
  return {
    requestId: request.id,
    feeDue: Number(request.fee_due),
    feeStatus: request.fee_status,
    waiverApplied: request.waiver_applied,
    checkoutUrl: request.payment_url,
    paymentReference: request.payment_ref,
    source: request.payment_source,
  }
}

function assertCitizen(request: NonNullable<Awaited<ReturnType<typeof getRequest>>>, citizenSub: string) {
  if (!request.citizen_sub || request.citizen_sub !== citizenSub) throw new Error('FORBIDDEN')
  if (request.status === 'rejected' || request.status === 'issued') throw new Error('NOT_PAYABLE')
}

export async function startRequestPayment(
  requestId: string,
  citizenSub: string,
  waiverCategory?: string,
): Promise<PaymentState> {
  const request = await getRequest(requestId)
  if (!request) throw new Error('NOT_FOUND')
  assertCitizen(request, citizenSub)
  if (request.fee_status === 'paid' || request.fee_status === 'waived' || request.payment_uuid) {
    return state(request)
  }

  const configuredFee = Math.max(0, Number(request.service.fee_amount))
  const waiver = waiverCategory
    ? request.service.waivers.find((item) => item.category === waiverCategory)
    : undefined
  if (waiverCategory && !waiver) throw new Error('INVALID_WAIVER')

  const waiverAmount = waiver?.waives === 'full' ? configuredFee : Math.max(0, Number(waiver?.amount ?? 0))
  const feeDue = Math.max(0, configuredFee - waiverAmount)
  const applied = waiver?.category ?? (configuredFee === 0 ? 'zero_fee' : null)
  const db = supabaseAdmin()

  if (feeDue === 0) {
    const { error } = await db.from('requests').update({
      fee_due: 0,
      fee_status: 'waived',
      waiver_applied: applied,
      payment_source: null,
      payment_checked_at: new Date().toISOString(),
    }).eq('id', requestId).eq('fee_status', 'unpaid')
    if (error) throw new Error(error.message)
    await recordEvent(requestId, 'citizen', 'fee_waived', { category: applied })
    return { ...state(request), feeDue: 0, feeStatus: 'waived', waiverApplied: applied }
  }

  const txnid = request.id
  if (request.payment_txnid && !request.payment_uuid) {
    const started = request.payment_checked_at ? new Date(request.payment_checked_at).getTime() : Date.now()
    if (Date.now() - started < 120_000) throw new Error('PAYMENT_IN_PROGRESS')
    await db.from('requests').update({ payment_txnid: null }).eq('id', requestId).eq('payment_txnid', request.payment_txnid).is('payment_uuid', null)
  }
  const { data: claimed, error: claimError } = await db.from('requests').update({
    fee_due: feeDue,
    fee_status: 'unpaid',
    waiver_applied: applied,
    payment_txnid: txnid,
    payment_checked_at: new Date().toISOString(),
  }).eq('id', requestId).is('payment_txnid', null).select('id').maybeSingle()
  if (claimError) throw new Error(claimError.message)
  if (!claimed) {
    const concurrent = await getRequest(requestId)
    if (concurrent?.payment_uuid) return state(concurrent)
    throw new Error('PAYMENT_IN_PROGRESS')
  }

  let payment
  try {
    payment = await generatePayment(feeDue, request.service.display_name || request.service.template.name, txnid)
  } catch (error) {
    await db.from('requests').update({ payment_txnid: null }).eq('id', requestId).is('payment_uuid', null)
    throw error
  }
  const { error } = await db.from('requests').update({
    payment_uuid: payment.data.uuid,
    payment_url: payment.data.checkoutUrl,
    payment_ref: payment.data.referenceNumber,
    payment_source: payment.source,
    payment_checked_at: new Date().toISOString(),
  }).eq('id', requestId).eq('payment_txnid', txnid).is('payment_uuid', null)
  if (error) throw new Error(error.message)

  await recordEvent(requestId, 'citizen', 'payment_created', {
    amount: feeDue,
    source: payment.source,
    reference: payment.data.referenceNumber,
  })
  const refreshed = await getRequest(requestId)
  if (!refreshed) throw new Error('NOT_FOUND')
  return state(refreshed)
}

export async function reconcileRequestPayment(
  requestId: string,
  citizenSub: string,
): Promise<PaymentState> {
  const request = await getRequest(requestId)
  if (!request) throw new Error('NOT_FOUND')
  assertCitizen(request, citizenSub)
  if (request.fee_status !== 'unpaid' || !request.payment_uuid) return state(request)

  const result = await checkPayment(request.payment_uuid)
  if (result.source === 'live' && result.data.amount > 0 && result.data.amount !== Number(request.fee_due)) {
    throw new Error('PAYMENT_AMOUNT_MISMATCH')
  }
  const paid = result.data.status === 'paid'
  const { error } = await supabaseAdmin().from('requests').update({
    fee_status: paid ? 'paid' : 'unpaid',
    payment_ref: result.data.referenceNumber ?? request.payment_ref,
    payment_source: result.source,
    payment_checked_at: new Date().toISOString(),
  }).eq('id', requestId)
  if (error) throw new Error(error.message)
  await recordEvent(requestId, 'citizen', 'payment_status_checked', {
    status: result.data.status,
    source: result.source,
    reference: result.data.referenceNumber,
  })
  const refreshed = await getRequest(requestId)
  if (!refreshed) throw new Error('NOT_FOUND')
  return state(refreshed)
}
