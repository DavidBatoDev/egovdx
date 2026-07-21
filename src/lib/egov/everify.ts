import 'server-only'
import { authHeaders, callEgov, egovFetch, getAccessToken, type EgovResult } from './client'

/**
 * #NationalID | eVerify — identity verification against PhilSys/NIDAS.
 *
 * The browser eVerify Face Liveness SDK returns the session ID required by
 * /api/query. Its session ID is deliberately distinct from the standalone
 * Face Liveness REST API token and must never be substituted with that token.
 */

/** Normalized shape the rest of the app consumes. */
export type VerifiedIdentity = {
  verified: boolean
  fullName: string
  firstName: string
  middleName: string
  lastName: string
  birthdate: string
  address: string
  /** eVerify confirms a current address, not a residency duration. */
  yearsOfResidency: null
  mobile: string | null
  /** eVerify does not return a PhilSys Card Number for this flow. */
  philsysReference: null
  /** eVerify's documented verification reference, for request audit/display. */
  everifyReference: string | null
}

export type EverifyQuery = {
  firstName: string
  middleName?: string | null
  lastName: string
  suffix?: string | null
  birthdate: string
  /** The exact `result.session_id` emitted by the eVerify Face Liveness SDK. */
  faceLivenessSessionId: string
}

type TokenResponse = {
  data?: {
    access_token?: unknown
    expires_at?: unknown
  }
}

async function token(): Promise<string> {
  return getAccessToken('EVERIFY', async () => {
    const response = await egovFetch<TokenResponse>('EVERIFY', '/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        client_id: process.env.EGOV_EVERIFY_CLIENT_ID,
        client_secret: process.env.EGOV_EVERIFY_CLIENT_SECRET,
      }),
    })

    const accessToken = response.data?.access_token
    if (typeof accessToken !== 'string' || !accessToken) {
      throw new Error('eVerify /api/auth returned no data.access_token')
    }

    return {
      token: accessToken,
      expiresInSeconds: secondsUntil(response.data?.expires_at),
    }
  })
}

function secondsUntil(expiresAt: unknown): number {
  const epochSeconds =
    typeof expiresAt === 'number'
      ? expiresAt
      : typeof expiresAt === 'string' && /^\d+$/.test(expiresAt)
        ? Number(expiresAt)
        : Number.NaN

  if (!Number.isFinite(epochSeconds)) return 3600

  // Avoid caching a token that is about to expire. getAccessToken also reserves
  // a 60-second skew window before returning an item from its cache.
  return Math.max(60, Math.floor(epochSeconds - Date.now() / 1000))
}

/** Verify Personal Information — POST /api/query. */
export async function verifyIdentity(q: EverifyQuery): Promise<EgovResult<VerifiedIdentity>> {
  return callEgov(
    'EVERIFY',
    async () => {
      const raw = await egovFetch<Record<string, unknown>>('EVERIFY', '/api/query', {
        method: 'POST',
        headers: authHeaders('EVERIFY', await token()),
        body: JSON.stringify({
          first_name: q.firstName,
          ...(q.middleName ? { middle_name: q.middleName } : {}),
          last_name: q.lastName,
          ...(q.suffix ? { suffix: q.suffix } : {}),
          birth_date: q.birthdate,
          face_liveness_session_id: q.faceLivenessSessionId,
        }),
      })
      return normalize(raw, q)
    },
    () => mockIdentity(q),
  )
}

/** QR Verify — POST /api/query/qr, also bound to the SDK liveness session. */
export async function verifyByQr(
  qrPayload: string,
  faceLivenessSessionId: string,
): Promise<EgovResult<VerifiedIdentity>> {
  return callEgov(
    'EVERIFY',
    async () => {
      const raw = await egovFetch<Record<string, unknown>>('EVERIFY', '/api/query/qr', {
        method: 'POST',
        headers: authHeaders('EVERIFY', await token()),
        body: JSON.stringify({
          value: qrPayload,
          face_liveness_session_id: faceLivenessSessionId,
        }),
      })
      return normalize(raw, {
        firstName: '',
        lastName: '',
        birthdate: '',
        faceLivenessSessionId,
      })
    },
    () =>
      mockIdentity({
        firstName: 'Juana',
        middleName: 'Dela',
        lastName: 'Cruz',
        birthdate: '1992-03-14',
        faceLivenessSessionId,
      }),
  )
}

/**
 * eVerify returns `full_name` and address values as single strings. The query
 * normally contains exact name parts from SSO, while QR verification does not;
 * split the documented name string only when those source parts are absent.
 */
function normalize(raw: Record<string, unknown>, q: EverifyQuery): VerifiedIdentity {
  const data = raw.data
  if (!isRecord(data)) throw new Error('eVerify response contained no data object')

  const fullName = stringValue(data.full_name)
  const parsedName = splitFullName(fullName)
  const firstName = q.firstName || parsedName.firstName
  const middleName = q.middleName ?? parsedName.middleName
  const lastName = q.lastName || parsedName.lastName

  return {
    verified: true,
    fullName: fullName || [firstName, middleName, lastName].filter(Boolean).join(' '),
    firstName,
    middleName,
    lastName,
    birthdate: stringValue(data.birth_date) || q.birthdate,
    address: stringValue(data.full_address) || stringValue(data.present_full_address),
    yearsOfResidency: null,
    mobile: stringOrNull(data.mobile_number),
    philsysReference: null,
    everifyReference: stringOrNull(data.reference),
  }
}

function mockIdentity(q: EverifyQuery): VerifiedIdentity {
  return {
    verified: true,
    fullName: [q.firstName, q.middleName, q.lastName].filter(Boolean).join(' '),
    firstName: q.firstName,
    middleName: q.middleName ?? '',
    lastName: q.lastName,
    birthdate: q.birthdate,
    address: '24 Sampaguita St., Barangay Plainview, Mandaluyong City, NCR',
    yearsOfResidency: null,
    mobile: '+639171234567',
    philsysReference: null,
    everifyReference: 'MOCK-EVERIFY-REFERENCE-0001',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function stringOrNull(value: unknown): string | null {
  const normalized = stringValue(value)
  return normalized || null
}

function splitFullName(fullName: string): {
  firstName: string
  middleName: string
  lastName: string
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' }
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] }

  // The documented eVerify sample uses a two-word surname (DELA CRUZ). This
  // preserves it; SSO-supplied parts remain authoritative whenever available.
  const surnameLength = parts.length >= 4 ? 2 : 1
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -surnameLength).join(' '),
    lastName: parts.slice(-surnameLength).join(' '),
  }
}
