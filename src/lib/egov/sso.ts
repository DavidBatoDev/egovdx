import 'server-only'
import { authHeaders, callEgov, egovFetch, type EgovResult } from './client'

/**
 * eGOV PH — Single sign-on.
 *
 * The documented SSO contract starts after an upstream eGovPH handoff has
 * issued an exchange code. This app does not own or guess that browser flow:
 * it exchanges the short-lived code server-side, then resolves the profile.
 */

export type EgovProfile = {
  sub: string
  fullName: string
  email: string | null
  mobile: string | null
  raw: Record<string, unknown>
}

type SsoTokenResponse = {
  access_token?: unknown
}

function partnerCredentials(): { partnerCode: string; partnerSecret: string } {
  const partnerCode = process.env.EGOV_SSO_PARTNER_CODE
  const partnerSecret = process.env.EGOV_SSO_PARTNER_SECRET

  if (!partnerCode || !partnerSecret) {
    throw new Error('EGOV_SSO_PARTNER_CODE and EGOV_SSO_PARTNER_SECRET must be set')
  }

  return { partnerCode, partnerSecret }
}

/** Exchange an upstream eGovPH code and resolve its authenticated profile. */
export async function exchangeCode(code: string): Promise<EgovResult<EgovProfile>> {
  return callEgov(
    'SSO',
    async () => {
      const { partnerCode, partnerSecret } = partnerCredentials()
      const tokenResponse = await egovFetch<SsoTokenResponse>('SSO', '/api/token', {
        method: 'POST',
        body: JSON.stringify({
          exchange_code: code,
          scope: 'SSO_AUTHENTICATION',
          partner_code: partnerCode,
          partner_secret: partnerSecret,
        }),
      })

      if (typeof tokenResponse.access_token !== 'string' || !tokenResponse.access_token) {
        throw new Error('eGovPH /api/token returned no access token')
      }

      const raw = await egovFetch<Record<string, unknown>>(
        'SSO',
        '/api/partner/sso_authentication',
        {
          method: 'POST',
          headers: authHeaders('SSO', tokenResponse.access_token),
        },
      )

      return normalizeProfile(raw)
    },
    () => mockProfile(code),
  )
}

function normalizeProfile(raw: Record<string, unknown>): EgovProfile {
  const profile = raw.data
  if (!isRecord(profile)) {
    throw new Error('eGovPH SSO response contained no profile data')
  }

  if (typeof profile.uniqid !== 'string' || !profile.uniqid) {
    throw new Error('eGovPH SSO response contained no uniqid')
  }

  const fullName = [
    profile.first_name,
    profile.middle_name,
    profile.last_name,
    profile.suffix,
  ]
    .filter(isNonEmptyString)
    .join(' ')

  return {
    sub: profile.uniqid,
    fullName: fullName || 'eGovPH User',
    email: stringOrNull(profile.email),
    mobile: stringOrNull(profile.mobile),
    raw,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Deterministic per code, so signing in twice as the same demo persona lands on
 * the same `officers` row instead of creating a new identity each time.
 */
function mockProfile(code: string): EgovProfile {
  const personas: Record<string, EgovProfile> = {
    officer: {
      sub: 'demo-officer-sub',
      fullName: 'Maria Santos',
      email: 'maria.santos@plainview.gov.ph',
      mobile: '+639171234567',
      raw: { persona: 'officer' },
    },
    reviewer: {
      sub: 'demo-reviewer-sub',
      fullName: 'Jose Reyes',
      email: 'jose.reyes@dict.gov.ph',
      mobile: '+639179876543',
      raw: { persona: 'reviewer' },
    },
    citizen: {
      sub: 'demo-citizen-sub',
      fullName: 'Juana Dela Cruz',
      email: 'juana.delacruz@example.ph',
      mobile: '+639175551234',
      raw: { persona: 'citizen' },
    },
  }

  return personas[code] ?? personas.citizen
}
