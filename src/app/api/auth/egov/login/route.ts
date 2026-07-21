import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthorizeUrl } from '@/lib/egov/sso'
import { egovMode } from '@/lib/egov/client'
import { encodeState } from '@/lib/auth/state'

export const runtime = 'nodejs'

/**
 * Start eGovPH SSO.
 *
 * In mock mode we skip the redirect to eGovPH entirely and hand the callback a
 * persona code, so the whole two-role flow stays demonstrable without the
 * sandbox. ?persona=officer|reviewer|citizen selects who signs in.
 */
export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get('persona') ?? 'citizen'
  const next = req.nextUrl.searchParams.get('next') ?? ''
  const state = encodeState({ persona, next })

  if (egovMode('SSO') === 'mock') {
    const url = new URL('/api/auth/egov/callback', req.nextUrl.origin)
    url.searchParams.set('code', persona)
    url.searchParams.set('state', state)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(buildAuthorizeUrl(state))
}
