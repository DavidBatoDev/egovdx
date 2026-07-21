import 'server-only'
import { callEgov, egovFetch, getAccessToken, type EgovResult } from './client'

/**
 * #NationalID | eVerify — identity verification against PhilSys.
 *
 *   POST {base}/api/auth            Authenticate (Generate Access Token)
 *   POST {base}/api/query           Verify Personal Information
 *   POST {base}/api/query/qr/check  QR Check
 *   POST {base}/api/query/qr        QR Verify
 *
 * This is the load-bearing integration: it's what lets us prefill a citizen's
 * name, address, and residency instead of asking them to retype what the
 * government already knows about them.
 */

/** Normalized shape the rest of the app consumes. Insulates UI from the wire format. */
export type VerifiedIdentity = {
  verified: boolean
  fullName: string
  firstName: string
  middleName: string
  lastName: string
  birthdate: string
  address: string
  /** Derived, not returned directly — see deriveResidencyYears. */
  yearsOfResidency: number | null
  mobile: string | null
  philsysReference: string | null
}

export type EverifyQuery = {
  firstName: string
  middleName?: string
  lastName: string
  birthdate: string
  /** PhilSys Card Number, when the citizen has one to hand. */
  pcn?: string
}

async function token(): Promise<string> {
  return getAccessToken('EVERIFY', async () => {
    const res = await egovFetch<{
      access_token?: string
      token?: string
      expires_in?: number
    }>('EVERIFY', '/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        client_id: process.env.EGOV_EVERIFY_CLIENT_ID,
        client_secret: process.env.EGOV_EVERIFY_CLIENT_SECRET,
      }),
    })

    const accessToken = res.access_token ?? res.token
    if (!accessToken) throw new Error('eVerify /api/auth returned no token')

    return { token: accessToken, expiresInSeconds: res.expires_in ?? 3600 }
  })
}

/**
 * The catalog documents the endpoint but not the response body, so we read
 * defensively across the field names PhilSys-adjacent APIs commonly use. When
 * the Postman collection lands, tighten this to the real shape — this function
 * is the only place that needs to change.
 */
function normalize(raw: Record<string, any>): VerifiedIdentity {
  const p = raw.data ?? raw.result ?? raw

  const first = p.firstName ?? p.first_name ?? p.givenName ?? ''
  const middle = p.middleName ?? p.middle_name ?? ''
  const last = p.lastName ?? p.last_name ?? p.familyName ?? ''

  const address =
    p.address ??
    p.permanentAddress ??
    p.permanent_address ??
    [p.houseNo, p.street, p.barangay, p.cityMunicipality, p.province]
      .filter(Boolean)
      .join(', ')

  return {
    verified: p.verified ?? p.isVerified ?? p.status === 'success',
    fullName: [first, middle, last].filter(Boolean).join(' ').trim(),
    firstName: first,
    middleName: middle,
    lastName: last,
    birthdate: p.birthdate ?? p.dateOfBirth ?? p.date_of_birth ?? '',
    address: address || '',
    yearsOfResidency: deriveResidencyYears(p),
    mobile: p.mobileNumber ?? p.mobile ?? p.contactNumber ?? null,
    philsysReference: p.pcn ?? p.philsysNumber ?? p.reference ?? null,
  }
}

/**
 * eVerify confirms *current* registered address; it does not return a residency
 * duration. Where a start date is available we compute from it, otherwise we
 * return null and the citizen declares it on the form.
 *
 * This gap is real and worth stating out loud in the pitch rather than
 * pretending the number is authoritative — the brief already concedes that
 * barangay-level residency history mostly isn't in eGovPH yet.
 */
function deriveResidencyYears(p: Record<string, any>): number | null {
  const since = p.residencySince ?? p.residency_start ?? p.addressSince
  if (!since) return null

  const start = new Date(since)
  if (Number.isNaN(start.getTime())) return null

  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return Math.floor(years)
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
    yearsOfResidency: 6,
    mobile: '+639171234567',
    philsysReference: '0000-0000-0000-0000',
  }
}

/** Verify Personal Information — POST /api/query */
export async function verifyIdentity(
  q: EverifyQuery,
): Promise<EgovResult<VerifiedIdentity>> {
  return callEgov(
    'EVERIFY',
    async () => {
      const raw = await egovFetch<Record<string, any>>('EVERIFY', '/api/query', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({
          first_name: q.firstName,
          middle_name: q.middleName ?? '',
          last_name: q.lastName,
          birthdate: q.birthdate,
          ...(q.pcn ? { pcn: q.pcn } : {}),
        }),
      })
      return normalize(raw)
    },
    () => mockIdentity(q),
  )
}

/** QR Verify — POST /api/query/qr. Used when the citizen presents a National ID QR. */
export async function verifyByQr(qrPayload: string): Promise<EgovResult<VerifiedIdentity>> {
  return callEgov(
    'EVERIFY',
    async () => {
      const raw = await egovFetch<Record<string, any>>('EVERIFY', '/api/query/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ qr: qrPayload }),
      })
      return normalize(raw)
    },
    () =>
      mockIdentity({
        firstName: 'Juana',
        middleName: 'Dela',
        lastName: 'Cruz',
        birthdate: '1992-03-14',
      }),
  )
}
