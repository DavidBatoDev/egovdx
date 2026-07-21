/**
 * SSO `state` round-trip.
 *
 * Carries the post-login destination through the redirect, plus (in mock mode)
 * which demo persona is signing in. base64url so it survives a query string.
 */

export type SsoState = { persona: string; next: string }

export function encodeState(value: SsoState): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function decodeState(raw: string | null): SsoState {
  if (!raw) return { persona: 'citizen', next: '' }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    return {
      persona: typeof parsed.persona === 'string' ? parsed.persona : 'citizen',
      next: typeof parsed.next === 'string' ? parsed.next : '',
    }
  } catch {
    return { persona: 'citizen', next: '' }
  }
}

/**
 * Only ever redirect to a path on this origin. Without this check, `next` is an
 * open redirect — an attacker mails a login link that bounces the citizen to a
 * lookalike site right after they authenticate.
 */
export function safeNext(next: string, fallback: string): string {
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
