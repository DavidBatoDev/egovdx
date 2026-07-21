import 'server-only'
import { callEgov, egovFetch, type EgovResult } from './client'

/**
 * eGOV PAY — fee assessment and collection.
 *
 *   POST  Generate Payment
 *   GET   Check Transaction Details
 *   PUT   Void Transaction
 *
 * The catalog lists the verbs but no paths, so the paths below are a best guess
 * and this service ships with EGOV_PAY_MODE=mock by default. Run
 * scripts/probe.ts against the sandbox to find the real ones, correct the
 * constants here, then flip to live.
 *
 * Fee assessment is a named stage in the core flow, so this can't be dropped —
 * but a fee waiver means many requests never reach a payment at all, which is
 * the honest reason the mock path is acceptable for a demo.
 */

const PATHS = {
  generate: '/api/payment/generate',
  check: '/api/payment/transaction',
  void: '/api/payment/void',
} as const

export type PaymentIntent = {
  referenceNumber: string
  /** Hosted checkout page, when the gateway returns one. */
  checkoutUrl: string | null
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'voided'
}

function authHeaders(): Record<string, string> {
  const key = process.env.EGOV_PAY_API_KEY
  return key ? { Authorization: `Bearer ${key}`, 'x-api-key': key } : {}
}

export async function generatePayment(
  amount: number,
  description: string,
  reference: string,
): Promise<EgovResult<PaymentIntent>> {
  return callEgov(
    'PAY',
    async () => {
      const raw = await egovFetch<Record<string, any>>('PAY', PATHS.generate, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount,
          description,
          reference_number: reference,
          currency: 'PHP',
        }),
      })

      const d = raw.data ?? raw
      return {
        referenceNumber: d.referenceNumber ?? d.reference_number ?? reference,
        checkoutUrl: d.checkoutUrl ?? d.checkout_url ?? d.paymentUrl ?? null,
        amount,
        status: 'pending' as const,
      }
    },
    () => ({
      referenceNumber: reference,
      // Routes to our own simulated checkout so the payment step is still
      // demonstrable end-to-end without a live gateway.
      checkoutUrl: `/pay/${encodeURIComponent(reference)}`,
      amount,
      status: 'pending' as const,
    }),
  )
}

export async function checkPayment(reference: string): Promise<EgovResult<PaymentIntent>> {
  return callEgov(
    'PAY',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'PAY',
        `${PATHS.check}/${encodeURIComponent(reference)}`,
        { headers: authHeaders() },
      )

      const d = raw.data ?? raw
      const status = String(d.status ?? '').toLowerCase()

      return {
        referenceNumber: reference,
        checkoutUrl: null,
        amount: Number(d.amount ?? 0),
        status: (['paid', 'success', 'settled'].includes(status)
          ? 'paid'
          : status === 'voided'
            ? 'voided'
            : status === 'failed'
              ? 'failed'
              : 'pending') as PaymentIntent['status'],
      }
    },
    () => ({
      referenceNumber: reference,
      checkoutUrl: null,
      amount: 0,
      status: 'paid' as const,
    }),
  )
}

export async function voidPayment(reference: string): Promise<EgovResult<{ voided: boolean }>> {
  return callEgov(
    'PAY',
    async () => {
      await egovFetch('PAY', `${PATHS.void}/${encodeURIComponent(reference)}`, {
        method: 'PUT',
        headers: authHeaders(),
      })
      return { voided: true }
    },
    () => ({ voided: true }),
  )
}
