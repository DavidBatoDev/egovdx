import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCode } from '@/lib/egov/sso'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  createSessionCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
  type Session,
  type SessionRole,
} from '@/lib/auth/session'
import { decodeState, safeNextForRole } from '@/lib/auth/state'

export const runtime = 'nodejs'

/**
 * eGovPH SSO callback.
 *
 * SSO tells us WHO this is. The `officers` table tells us what they may do —
 * anyone without a row there is a citizen. That split is the two-role SSO story:
 * one identity provider, role-specific workspaces, and role assignment that
 * stays under DICT/LGU control rather than being self-asserted at login.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('exchange_code')
  const { next } = decodeState(req.nextUrl.searchParams.get('state'))

  if (!code) {
    return NextResponse.redirect(new URL('/signin?error=missing_exchange_code', req.nextUrl.origin))
  }

  const { data: profile, source } = await exchangeCode(code)
  if (source === 'fallback') {
    return NextResponse.redirect(new URL('/signin?error=sso_unavailable', req.nextUrl.origin))
  }

  // Roles come from the database, so an unreachable database means we cannot
  // say what this person is allowed to do. Failing closed with a clear message
  // beats defaulting to 'citizen' — a silent role downgrade looks like a
  // permissions bug and sends someone hunting in the wrong place.
  let officer: { role: string; lgu_id: string | null; full_name: string } | null
  try {
    const { data, error } = await supabaseAdmin()
      .from('officers')
      .select('role, lgu_id, full_name')
      .eq('egov_sub', profile.sub)
      .maybeSingle()

    if (error) throw new Error(error.message)
    officer = data
  } catch (err) {
    console.error('[sso] officer lookup failed:', err)
    return NextResponse.redirect(
      new URL('/signin?error=database_unavailable', req.nextUrl.origin),
    )
  }

  const role: SessionRole = (officer?.role as SessionRole) ?? 'citizen'

  const session: Session = {
    sub: profile.sub,
    name: officer?.full_name ?? profile.fullName,
    role,
    lguId: officer?.lgu_id ?? null,
    mobile: profile.mobile,
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    suffix: profile.suffix,
    birthdate: profile.birthDate,
    birthDate: profile.birthDate,
    address: profile.address,
    ssoSource: source,
  }

  // Logged so that after a first real SSO login you can copy the subject into
  // the officers table:  update officers set egov_sub = '<sub>' where ...
  console.log(`[sso:${source}] signed in sub=${profile.sub} role=${role}`)

  const fallback = role === 'officer' ? '/lgu' : role === 'reviewer' ? '/review' : '/citizen/services'
  const response = NextResponse.redirect(
    new URL(safeNextForRole(next, role, fallback), req.nextUrl.origin),
  )
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionCookie(session),
    sessionCookieOptions(),
  )
  return response
}
