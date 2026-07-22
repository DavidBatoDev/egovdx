import { NextResponse, type NextRequest } from 'next/server'
import { clearSession } from '@/lib/auth/session'
import { egovMode } from '@/lib/egov/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // eGovPH publishes no single-logout contract. In live mode this local endpoint
  // is deliberately inert and hidden; the provider owns session termination.
  if (egovMode('SSO') === 'live') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  await clearSession()
  return NextResponse.redirect(new URL('/', req.nextUrl.origin))
}
