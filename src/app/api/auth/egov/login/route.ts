import { NextResponse, type NextRequest } from 'next/server'
import { egovMode } from '@/lib/egov/client'
import { encodeState } from '@/lib/auth/state'

export const runtime = 'nodejs'

/**
 * Start eGovPH SSO.
 *
 * In mock mode we skip the upstream eGovPH handoff entirely and give the
 * callback a deterministic exchange code, so the whole two-role flow stays
 * demonstrable without the sandbox. In live mode the documented API has no
 * authorization-initiation URL, so the app waits for an external handoff to
 * its callback instead of guessing one.
 */
export async function GET(req: NextRequest) {
  const persona = req.nextUrl.searchParams.get('persona') ?? 'citizen'
  const next = req.nextUrl.searchParams.get('next') ?? ''
  const state = encodeState({ persona, next })

  if (egovMode('SSO') === 'mock') {
    const url = new URL('/api/auth/egov/callback', req.nextUrl.origin)
    url.searchParams.set('exchange_code', persona)
    url.searchParams.set('state', state)
    return NextResponse.redirect(url)
  }

  const url = new URL('/signin', req.nextUrl.origin)
  url.searchParams.set('error', 'sso_handoff_required')
  if (next) url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}
