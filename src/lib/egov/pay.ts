import 'server-only'
import { createHmac } from 'node:crypto'
import { authHeaders, callEgov, egovFetch, type EgovResult } from './client'

/** Normalized eGOV PAY transaction used by request, track, and callback routes. */
export type PaymentIntent = {
  /** eGOV PAY's transaction UUID; use this for status checks and voids. */
  uuid: string
  /** Merchant-generated transaction ID (the eGovDX request ID). */
  transactionId: string
  referenceNumber: string | null
  /** Hosted gateway page. Null for a status-only response. */
  checkoutUrl: string | null
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'voided'
}

const PATHS = {
  transaction: '/api/v1/transaction',
} as const

function apiToken(): string {
  const token = process.env.EGOV_PAY_API_TOKEN
  if (!token) throw new Error('EGOV_PAY_API_TOKEN is not set')
  return token
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not set')
  return url.replace(/\/$/, '')
}

/** Keep the HMAC's amount representation stable and reject invalid fee input early. */
function amountString(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be a positive finite number')
  }
  return String(amount)
}

function paymentStatus(value: unknown): PaymentIntent['status'] {
  const status = String(value ?? '').trim().toLowerCase()
  if (['paid', 'success', 'settled', 'completed'].includes(status)) return 'paid'
  if (['void', 'voided', 'cancelled', 'canceled'].includes(status)) return 'voided'
  if (['failed', 'failure', 'declined', 'expired'].includes(status)) return 'failed'
  return 'pending' // e.g. INITIAL / PENDING
}

/** The sole boundary between provider payload variants and eGovDX types. */
export function normalizePayment(
  raw: Record<string, unknown>,
  fallback: Pick<PaymentIntent, 'uuid' | 'transactionId' | 'amount'>,
): PaymentIntent {
  const data = (raw.data ?? raw) as Record<string, unknown>
  const channel = (data.channel ?? {}) as Record<string, unknown>
  const reference = data.refno ?? channel.refno
  return {
    uuid: String(data.uuid ?? fallback.uuid),
    transactionId: String(data.txnid ?? fallback.transactionId),
    referenceNumber: reference ? String(reference) : null,
    checkoutUrl: data.url ? String(data.url) : null,
    amount: Number(data.amount ?? fallback.amount),
    status: paymentStatus(data.payment_status ?? data.status),
  }
}

export async function generatePayment(
  amount: number,
  description: string,
  txnid: string,
): Promise<EgovResult<PaymentIntent>> {
  const normalizedAmount = amountString(amount)
  if (!txnid.trim()) throw new Error('Payment transaction ID is required')
  if (!description.trim()) throw new Error('Payment description is required')

  return callEgov(
    'PAY',
    async () => {
      const token = apiToken()
      const digest = createHmac('sha256', token)
        .update(`${normalizedAmount}|${txnid}`)
        .digest('hex')
      const raw = await egovFetch<Record<string, unknown>>('PAY', PATHS.transaction, {
        method: 'POST',
        headers: {
          ...authHeaders('PAY', token),
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          items: [{ name: description, amount }],
          amount,
          settlement_template_uuid: process.env.EGOV_PAY_SETTLEMENT_TEMPLATE_UUID,
          txnid,
          redirect_url: `${appUrl()}/track/${encodeURIComponent(txnid)}`,
          callback_url: `${appUrl()}/api/pay/callback`,
          digest,
          currency: 'PHP',
        }),
      })
      return normalizePayment(raw, { uuid: txnid, transactionId: txnid, amount })
    },
    () => ({
      uuid: `mock-pay-${txnid}`,
      transactionId: txnid,
      referenceNumber: `MOCK-${txnid.slice(0, 8).toUpperCase()}`,
      checkoutUrl: `/pay/${encodeURIComponent(txnid)}`,
      amount,
      status: 'pending',
    }),
  )
}

export async function checkPayment(uuid: string): Promise<EgovResult<PaymentIntent>> {
  if (!uuid.trim()) throw new Error('Payment UUID is required')
  return callEgov(
    'PAY',
    async () => {
      const token = apiToken()
      const raw = await egovFetch<Record<string, unknown>>(
        'PAY',
        `${PATHS.transaction}/${encodeURIComponent(uuid)}`,
        {
          headers: {
            ...authHeaders('PAY', token),
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )
      return normalizePayment(raw, { uuid, transactionId: uuid, amount: 0 })
    },
    () => ({
      uuid,
      transactionId: uuid.replace(/^mock-pay-/, ''),
      referenceNumber: `MOCK-${uuid.slice(-8).toUpperCase()}`,
      checkoutUrl: null,
      amount: 0,
      status: 'paid',
    }),
  )
}

export async function voidPayment(uuid: string): Promise<EgovResult<{ voided: boolean }>> {
  if (!uuid.trim()) throw new Error('Payment UUID is required')
  return callEgov(
    'PAY',
    async () => {
      const token = apiToken()
      await egovFetch('PAY', `${PATHS.transaction}/${encodeURIComponent(uuid)}/void`, {
        method: 'PUT',
        headers: {
          ...authHeaders('PAY', token),
          'Content-Type': 'application/json; charset=utf-8',
        },
      })
      return { voided: true }
    },
    () => ({ voided: true }),
  )
}
