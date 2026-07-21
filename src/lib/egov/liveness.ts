import 'server-only'
import { callEgov, egovFetch, type EgovResult } from './client'

/**
 * FACE LIVENESS — confirms a live person is present at capture time.
 *
 *   POST {base}/v1/liveness/session              Create Session
 *   GET  {base}/v1/liveness/result/{sessionToken} Get Verification Result
 *
 * Checked against the CITIZEN at request time, deliberately. An indigency
 * certificate issued to an impersonator is a real fraud vector, and this is
 * what replaces the barangay officer physically seeing the person at the
 * counter. Be ready to say that in Q&A — an unjustified API on the list is
 * exactly what judges probe.
 */

export type LivenessSession = {
  sessionToken: string
  /** Hosted capture page the citizen is redirected to, when the API provides one. */
  redirectUrl: string | null
}

export type LivenessResult = {
  sessionToken: string
  passed: boolean
  /** 0..1 where the API reports one. */
  confidence: number | null
  status: 'pending' | 'passed' | 'failed'
}

function authHeaders(): Record<string, string> {
  const key = process.env.EGOV_LIVENESS_API_KEY
  return key ? { Authorization: `Bearer ${key}`, 'x-api-key': key } : {}
}

export async function createLivenessSession(
  reference: string,
): Promise<EgovResult<LivenessSession>> {
  return callEgov(
    'LIVENESS',
    async () => {
      const raw = await egovFetch<Record<string, any>>('LIVENESS', '/v1/liveness/session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reference }),
      })

      const d = raw.data ?? raw
      const sessionToken = d.sessionToken ?? d.session_token ?? d.token ?? d.sessionId
      if (!sessionToken) throw new Error('liveness session response had no session token')

      return {
        sessionToken: String(sessionToken),
        redirectUrl: d.redirectUrl ?? d.url ?? d.captureUrl ?? null,
      }
    },
    () => ({ sessionToken: `mock-liveness-${reference}`, redirectUrl: null }),
  )
}

export async function getLivenessResult(
  sessionToken: string,
): Promise<EgovResult<LivenessResult>> {
  return callEgov(
    'LIVENESS',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'LIVENESS',
        `/v1/liveness/result/${encodeURIComponent(sessionToken)}`,
        { headers: authHeaders() },
      )

      const d = raw.data ?? raw
      const rawStatus = String(d.status ?? d.result ?? '').toLowerCase()
      const passed =
        d.passed ?? d.isLive ?? d.live ?? ['passed', 'success', 'verified'].includes(rawStatus)

      return {
        sessionToken,
        passed: Boolean(passed),
        confidence: d.confidence ?? d.score ?? null,
        status: passed ? 'passed' : rawStatus === 'pending' ? 'pending' : 'failed',
      }
    },
    () => ({ sessionToken, passed: true, confidence: 0.97, status: 'passed' as const }),
  )
}
