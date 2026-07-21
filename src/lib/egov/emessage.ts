import 'server-only'
import { authHeaders, callEgov, egovFetch, type EgovResult } from './client'

export type SmsResult = { messageId: string | null; accepted: boolean }

/** Normalize Philippine mobile input to the eMessage-required E.164 format. */
export function normalizeMobile(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, '')
  const digits = compact.replace(/^\+/, '')
  let national: string

  if (/^09\d{9}$/.test(digits)) national = digits.slice(1)
  else if (/^9\d{9}$/.test(digits)) national = digits
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2)
  else throw new Error('Enter a valid Philippine mobile number')

  return `+63${national}`
}

/** The sole boundary between provider payload variants and the app's SMS type. */
export function normalizeSms(raw: Record<string, unknown>): SmsResult {
  const data = (raw.data ?? raw) as Record<string, unknown>
  const message = String(data.message ?? '').toLowerCase()
  const status = String(data.status ?? '').toLowerCase()
  return {
    messageId: data.message_id ?? data.messageId ?? data.id ? String(data.message_id ?? data.messageId ?? data.id) : null,
    accepted: data.success === false ? false : !['failed', 'error', 'rejected'].includes(status) && !message.includes('failed'),
  }
}

export async function pushSms(
  mobile: string,
  message: string,
): Promise<EgovResult<SmsResult>> {
  const requestedNumber = normalizeMobile(mobile)
  if (!message.trim()) throw new Error('SMS message is required')

  return callEgov(
    'EMESSAGE',
    async () => {
      const token = process.env.EGOV_EMESSAGE_API_TOKEN
      if (!token) throw new Error('EGOV_EMESSAGE_API_TOKEN is not set')
      const testRecipient = process.env.EGOV_EMESSAGE_TEST_NUMBER
      if (!testRecipient) throw new Error('EGOV_EMESSAGE_TEST_NUMBER is required for controlled live SMS')
      const number = normalizeMobile(testRecipient)
      const raw = await egovFetch<Record<string, unknown>>('EMESSAGE', '/messaging/v1/sms/push', {
        method: 'POST',
        headers: authHeaders('EMESSAGE', token),
        body: JSON.stringify({ number, message }),
      })
      return normalizeSms(raw)
    },
    () => {
      console.log(`[emessage:mock] accepted issuance message for ${requestedNumber.slice(0, 4)}••••${requestedNumber.slice(-3)}`)
      return { messageId: 'mock-message-id', accepted: true }
    },
  )
}

export function issuedSmsBody(serviceName: string, controlNumber: string, url: string) {
  return (
    `eSee LGU: Your ${serviceName} (${controlNumber}) has been approved and is ready ` +
    `for download. View and verify: ${url}`
  )
}
