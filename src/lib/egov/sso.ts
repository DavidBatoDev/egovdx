import 'server-only'
import { callEgov, egovFetch, getAccessToken, type EgovResult } from './client'

/**
 * eGOV PH — Single sign-on.
 *
 *   POST {base}/api/token                      Generate Access Token (partner-level)
 *   POST {base}/api/partner/sso_authentication SSO Authentication (exchange user code)
 *
 * Two distinct roles enter through this one integration: a citizen signing into
 * the request flow, and an LGU/barangay officer signing into the config
 * console. SSO establishes identity; the `officers` table decides which console
 * that identity may open.
 *
 * The catalog does not publish the authorize-redirect URL, only these two POST
 * endpoints, so buildAuthorizeUrl below is a best guess. Confirm against the
 * Postman collection — the rest of the flow is unaffected by getting it wrong.
 */

export type EgovProfile = {
  sub: string
  fullName: string
  email: string | null
  mobile: string | null
  raw: Record<string, unknown>
}

/** Partner-level token, cached. Not the citizen's token. */
async function partnerToken(): Promise<string> {
  return getAccessToken('SSO', async () => {
    const res = await egovFetch<Record<string, any>>('SSO', '/api/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: process.env.EGOV_SSO_CLIENT_ID,
        client_secret: process.env.EGOV_SSO_CLIENT_SECRET,
      }),
    })

    const token = res.access_token ?? res.token ?? res.data?.access_token
    if (!token) throw new Error('eGovPH /api/token returned no access token')

    return { token, expiresInSeconds: res.expires_in ?? 3600 }
  })
}

export function buildAuthorizeUrl(state: string): string {
  const base = process.env.EGOV_SSO_BASE_URL?.replace(/\/$/, '') ?? ''
  const params = new URLSearchParams({
    client_id: process.env.EGOV_SSO_CLIENT_ID ?? '',
    redirect_uri: process.env.EGOV_SSO_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: 'openid profile',
    state,
  })
  return `${base}/authorize?${params}`
}

/** Exchange the code eGovPH handed back for the citizen's profile. */
export async function exchangeCode(code: string): Promise<EgovResult<EgovProfile>> {
  return callEgov(
    'SSO',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'SSO',
        '/api/partner/sso_authentication',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${await partnerToken()}` },
          body: JSON.stringify({
            code,
            redirect_uri: process.env.EGOV_SSO_REDIRECT_URI,
          }),
        },
      )

      return normalizeProfile(raw)
    },
    () => mockProfile(code),
  )
}

function normalizeProfile(raw: Record<string, any>): EgovProfile {
  const p = raw.data ?? raw.user ?? raw.profile ?? raw

  const sub = p.sub ?? p.id ?? p.userId ?? p.user_id ?? p.uuid
  if (!sub) throw new Error('SSO response contained no subject identifier')

  const fullName =
    p.name ??
    p.fullName ??
    [p.firstName ?? p.first_name, p.lastName ?? p.last_name].filter(Boolean).join(' ')

  return {
    sub: String(sub),
    fullName: fullName || 'eGovPH User',
    email: p.email ?? null,
    mobile: p.mobile ?? p.mobileNumber ?? p.contactNumber ?? null,
    raw: p,
  }
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
