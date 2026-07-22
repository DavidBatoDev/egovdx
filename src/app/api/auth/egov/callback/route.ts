import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCode } from '@/lib/egov/sso'
import {
  createSessionCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
  type Session,
} from '@/lib/auth/session'
import { decodeState, safeNext } from '@/lib/auth/state'
import {
  isMissingIdentityDirectory,
  resolveSsoRole,
  syncEgovIdentity,
} from '@/lib/auth/egov-identity'

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

  // The identity directory is the durable record of an SSO user. Roles remain
  // server-owned: exact opt-in sandbox identities or the officer directory,
  // never a persona value or a browser-submitted role.
  let resolution: Awaited<ReturnType<typeof resolveSsoRole>>
  try {
    try {
      await syncEgovIdentity(profile, source)
    } catch (err) {
      // A developer who has not applied the new migration still needs mock SSO
      // for all other implementation harnesses. Live mode remains fail-closed:
      // it must persist the provider-owned identity before creating a session.
      if (source !== 'mock' || !isMissingIdentityDirectory(err)) throw err
      console.warn('[sso:mock] egov_identities is unavailable; skipping mock-only profile persistence')
    }
    resolution = await resolveSsoRole(profile)
  } catch (err) {
    console.error('[sso] identity directory failed:', err)
    return NextResponse.redirect(
      new URL('/signin?error=database_unavailable', req.nextUrl.origin),
    )
  }

  const { role, officer } = resolution

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
  console.log(`[sso:${source}] signed in sub=${profile.sub} role=${role} resolution=${resolution.source}`)

  const fallback = role === 'officer' ? '/lgu' : role === 'reviewer' ? '/review' : '/citizen/services'
  const response = NextResponse.redirect(new URL(safeNext(next, fallback), req.nextUrl.origin))
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionCookie(session),
    sessionCookieOptions(),
  )
  return response
}
