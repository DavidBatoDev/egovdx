import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCode } from '@/lib/egov/sso'
import { supabaseAdmin } from '@/lib/supabase/server'
import { setSession, type SessionRole } from '@/lib/auth/session'
import { decodeState, safeNext } from '@/lib/auth/state'

export const runtime = 'nodejs'

/**
 * eGovPH SSO callback.
 *
 * SSO tells us WHO this is. The `officers` table tells us what they may do —
 * anyone without a row there is a citizen. That split is the two-role SSO story:
 * one identity provider, two very different consoles, and role assignment that
 * stays under DICT/LGU control rather than being self-asserted at login.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const { next } = decodeState(req.nextUrl.searchParams.get('state'))

  if (!code) {
    return NextResponse.redirect(new URL('/signin?error=missing_code', req.nextUrl.origin))
  }

  const { data: profile, source } = await exchangeCode(code)

  const { data: officer } = await supabaseAdmin()
    .from('officers')
    .select('role, lgu_id, full_name')
    .eq('egov_sub', profile.sub)
    .maybeSingle()

  const role: SessionRole = (officer?.role as SessionRole) ?? 'citizen'

  await setSession({
    sub: profile.sub,
    name: officer?.full_name ?? profile.fullName,
    role,
    lguId: officer?.lgu_id ?? null,
    mobile: profile.mobile,
  })

  // Logged so that after a first real SSO login you can copy the subject into
  // the officers table:  update officers set egov_sub = '<sub>' where ...
  console.log(`[sso:${source}] signed in sub=${profile.sub} role=${role}`)

  const fallback = role === 'officer' ? '/console' : role === 'reviewer' ? '/review' : '/'
  return NextResponse.redirect(new URL(safeNext(next, fallback), req.nextUrl.origin))
}
