import 'server-only'
import { callEgov, egovFetch, type EgovResult } from './client'

/**
 * eMessage — SMS notification.
 *
 *   POST {base}/messaging/v1/sms/push
 *
 * Small integration, cleanest impact story in the project: "your barangay
 * clearance is approved and ready for download" removes a return trip to the
 * hall. For someone taking two jeepney rides and losing half a day's wage to
 * check whether a document is ready, that message IS the product.
 */

export type SmsResult = { messageId: string | null; accepted: boolean }

export async function pushSms(
  mobile: string,
  message: string,
): Promise<EgovResult<SmsResult>> {
  return callEgov(
    'EMESSAGE',
    async () => {
      const key = process.env.EGOV_EMESSAGE_API_KEY
      const raw = await egovFetch<Record<string, any>>(
        'EMESSAGE',
        '/messaging/v1/sms/push',
        {
          method: 'POST',
          headers: key ? { Authorization: `Bearer ${key}`, 'x-api-key': key } : {},
          body: JSON.stringify({ mobile_number: normalizeMobile(mobile), message }),
        },
      )

      const d = raw.data ?? raw
      return {
        messageId: d.messageId ?? d.message_id ?? d.id ?? null,
        accepted: d.success ?? (d.status ? d.status === 'success' : true),
      }
    },
    () => {
      console.log(`[emessage:mock] → ${mobile}: ${message}`)
      return { messageId: 'mock-message-id', accepted: true }
    },
  )
}

/** PH mobile numbers arrive as 09xx, +639xx, or 639xx. Normalize to 639xxxxxxxxx. */
function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('63')) return digits
  if (digits.startsWith('0')) return `63${digits.slice(1)}`
  if (digits.startsWith('9')) return `63${digits}`
  return digits
}

export function issuedSmsBody(serviceName: string, controlNumber: string, url: string) {
  return (
    `eGovDX: Your ${serviceName} (${controlNumber}) has been approved and is ready ` +
    `for download. View and verify: ${url}`
  )
}
