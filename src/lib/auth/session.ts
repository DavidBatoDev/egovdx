import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { EgovSource } from '@/lib/egov/client'

/**
 * Session = a signed JWT in an httpOnly cookie.
 *
 * eGovPH SSO authenticates (who is this person); the `officers` table
 * authorizes (what may they do). Both results are baked in here at callback
 * time so no page needs a second round trip to find out whether the visitor is
 * a citizen, a barangay officer, or a DICT reviewer.
 */

export const SESSION_COOKIE = 'egovdx_session'
const MAX_AGE_SECONDS = 60 * 60 * 8 // one working day

export type SessionRole = 'citizen' | 'officer' | 'reviewer'

export type Session = {
  sub: string
  name: string
  role: SessionRole
  /** Set for officers; null for citizens and DICT reviewers. */
  lguId: string | null
  mobile: string | null
  /** Source of the SSO profile used to establish this session. */
  ssoSource: EgovSource | null
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET must be set to a random string of 16+ characters')
  }
  return new TextEncoder().encode(s)
}

export async function createSessionCookie(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, await createSessionCookie(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret())
    return {
      sub: String(payload.sub ?? payload.subject ?? ''),
      name: String(payload.name ?? ''),
      role: (payload.role as SessionRole) ?? 'citizen',
      lguId: (payload.lguId as string | null) ?? null,
      mobile: (payload.mobile as string | null) ?? null,
      ssoSource: isEgovSource(payload.ssoSource) ? payload.ssoSource : null,
    }
  } catch {
    return null // expired or tampered — treat as signed out
  }
}

function isEgovSource(value: unknown): value is EgovSource {
  return value === 'live' || value === 'mock' || value === 'fallback'
}

export async function clearSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** Throws unless the visitor holds one of the given roles. */
export async function requireRole(...roles: SessionRole[]): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHENTICATED')
  if (!roles.includes(session.role)) throw new Error('FORBIDDEN')
  return session
}
