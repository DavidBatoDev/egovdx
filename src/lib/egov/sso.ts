import 'server-only'
import { authHeaders, callEgov, egovFetch, type EgovResult } from './client'

export type EgovProfile = {
  sub: string
  fullName: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  birthDate: string
  address: string
  email: string | null
  mobile: string | null
  raw: Record<string, unknown>
}

export async function exchangeCode(code: string): Promise<EgovResult<EgovProfile>> {
  return callEgov(
    'SSO',
    async () => {
      const partnerCode = process.env.EGOV_SSO_PARTNER_CODE
      const partnerSecret = process.env.EGOV_SSO_PARTNER_SECRET
      if (!partnerCode || !partnerSecret) throw new Error('SSO partner credentials are not set')
      const token = await egovFetch<{ access_token?: string }>('SSO', '/api/token', {
        method: 'POST',
        body: JSON.stringify({
          exchange_code: code,
          scope: 'SSO_AUTHENTICATION',
          partner_code: partnerCode,
          partner_secret: partnerSecret,
        }),
      })
      if (!token.access_token) throw new Error('eGovPH /api/token returned no access token')
      const raw = await egovFetch<Record<string, unknown>>('SSO', '/api/partner/sso_authentication', {
        method: 'POST',
        headers: authHeaders('SSO', token.access_token),
      })
      return normalizeProfile(raw)
    },
    () => mockProfile(code),
  )
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeProfile(raw: Record<string, unknown>): EgovProfile {
  const p = record(raw.data)
  const sub = text(p.uniqid)
  if (!sub) throw new Error('eGovPH SSO response contained no data.uniqid')
  const firstName = text(p.first_name)
  const middleName = text(p.middle_name)
  const lastName = text(p.last_name)
  const suffix = text(p.suffix)
  return {
    sub,
    fullName: [firstName, middleName, lastName, suffix].filter(Boolean).join(' ') || 'eGovPH User',
    firstName,
    middleName,
    lastName,
    suffix,
    birthDate: text(p.birth_date),
    address: text(p.address),
    email: text(p.email) || null,
    mobile: text(p.mobile) || null,
    raw,
  }
}

function mockProfile(code: string): EgovProfile {
  const base = {
    firstName: 'Juana', middleName: 'Santos', lastName: 'Dela Cruz', suffix: '',
    birthDate: '1992-03-14', address: '24 Sampaguita St., Barangay Plainview, Mandaluyong City, NCR',
  }
  const personas: Record<string, EgovProfile> = {
    officer: { ...base, sub: 'demo-officer-sub', fullName: 'Maria Santos', firstName: 'Maria', middleName: '', lastName: 'Santos', email: 'maria.santos@plainview.gov.ph', mobile: '+639171234567', raw: { persona: 'officer' } },
    reviewer: { ...base, sub: 'demo-reviewer-sub', fullName: 'Jose Reyes', firstName: 'Jose', middleName: '', lastName: 'Reyes', email: 'jose.reyes@dict.gov.ph', mobile: '+639179876543', raw: { persona: 'reviewer' } },
    citizen: { ...base, sub: 'demo-citizen-sub', fullName: 'Juana Santos Dela Cruz', email: 'juana.delacruz@example.ph', mobile: '+639175551234', raw: { persona: 'citizen' } },
  }
  return personas[code] ?? personas.citizen
}
