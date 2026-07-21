import 'server-only'
import { authHeaders, callEgov, egovFetch, type EgovResult } from './client'

/**
 * FACE LIVENESS — standalone REST integration.
 *
 * This is distinct from the browser eVerify Face Liveness SDK. The SDK's
 * session_id feeds eVerify; this API's token and confidence score never do.
 */

export type LivenessAction = 'redirect' | 'post' | 'close'

export type CreateLivenessSessionOptions = {
  action: LivenessAction
  callbackUrl?: string
  delay?: number
}

export type LivenessSession = {
  sessionToken: string
  redirectUrl: string | null
}

export type LivenessResult = {
  sessionToken: string
  /** True only when the documented status is SUCCEEDED and score is >= 95. */
  passed: boolean
  /** Standalone REST confidence score, from 0 to 100. */
  confidence: number | null
  status: 'pending' | 'passed' | 'failed'
}

const MINIMUM_CONFIDENCE = 95

export async function createLivenessSession(
  options: CreateLivenessSessionOptions,
): Promise<EgovResult<LivenessSession>> {
  validateCreateOptions(options)

  return callEgov(
    'LIVENESS',
    async () => {
      const raw = await egovFetch<StandaloneSessionResponse>('LIVENESS', '/v1/liveness/session', {
        method: 'POST',
        headers: authHeaders('LIVENESS', livenessApiKey()),
        body: JSON.stringify({
          action: options.action,
          ...(options.callbackUrl ? { callback_url: options.callbackUrl } : {}),
          ...(options.delay === undefined ? {} : { delay: options.delay }),
        }),
      })

      if (typeof raw.token !== 'string' || !raw.token) {
        throw new Error('liveness session response had no token')
      }

      return {
        sessionToken: raw.token,
        redirectUrl: typeof raw.url === 'string' ? raw.url : null,
      }
    },
    () => ({
      sessionToken: `mock-liveness-${options.action}`,
      redirectUrl: options.action === 'redirect' ? options.callbackUrl ?? null : null,
    }),
  )
}

export async function getLivenessResult(
  sessionToken: string,
): Promise<EgovResult<LivenessResult>> {
  return callEgov(
    'LIVENESS',
    async () => {
      const raw = await egovFetch<StandaloneResultResponse>(
        'LIVENESS',
        `/v1/liveness/result/${encodeURIComponent(sessionToken)}`,
        { headers: authHeaders('LIVENESS', livenessApiKey()) },
      )

      if (typeof raw.confidence_score !== 'number') {
        throw new Error('liveness result response had no confidence_score')
      }

      const succeeded = raw.status === 'SUCCEEDED'
      const passed = succeeded && raw.confidence_score >= MINIMUM_CONFIDENCE

      return {
        sessionToken,
        passed,
        confidence: raw.confidence_score,
        status: passed ? 'passed' : raw.status === 'PENDING' ? 'pending' : 'failed',
      }
    },
    () => ({
      sessionToken,
      passed: true,
      confidence: 98.7,
      status: 'passed',
    }),
  )
}

function livenessApiKey(): string {
  const key = process.env.EGOV_LIVENESS_API_KEY
  if (!key) throw new Error('EGOV_LIVENESS_API_KEY must be set')
  return key
}

function validateCreateOptions(options: CreateLivenessSessionOptions): void {
  if (options.action === 'redirect' && !options.callbackUrl) {
    throw new Error('callbackUrl is required when action is redirect')
  }
  if (options.delay !== undefined && (!Number.isInteger(options.delay) || options.delay < 0)) {
    throw new Error('delay must be a non-negative integer')
  }
}

type StandaloneSessionResponse = {
  token?: unknown
  url?: unknown
}

type StandaloneResultResponse = {
  status?: unknown
  confidence_score?: unknown
}
