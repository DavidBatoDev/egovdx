import 'server-only'

/**
 * Shared plumbing for every eGovPH API.
 *
 * Two jobs:
 *   1. Cache the short-lived access tokens each service issues separately.
 *   2. Guarantee that a sandbox failure degrades to a fixture instead of a
 *      stack trace on screen.
 *
 * (2) is not defensive programming for its own sake. Two of the seven APIs we
 * registered (eGOV PAY, eGOV chain) have no published endpoints, and the demo
 * gets recorded against a government sandbox we don't control. A 500 from a
 * sandbox should cost us a console line, not the take.
 */

export const EGOV_SERVICES = [
  'SSO',
  'EVERIFY',
  'LIVENESS',
  'EMESSAGE',
  'AI',
  'PAY',
  'CHAIN',
] as const

export type EgovService = (typeof EGOV_SERVICES)[number]

/** Where a given response actually came from. Surfaced in the UI as a badge. */
export type EgovSource = 'live' | 'mock' | 'fallback'

export type EgovResult<T> = {
  data: T
  source: EgovSource
  /** Present only when source === 'fallback'. */
  error?: string
}

export function egovMode(service: EgovService): 'live' | 'mock' {
  return process.env[`EGOV_${service}_MODE`] === 'mock' ? 'mock' : 'live'
}

export function egovBaseUrl(service: EgovService): string {
  const url = process.env[`EGOV_${service}_BASE_URL`]
  if (!url) throw new Error(`EGOV_${service}_BASE_URL is not set`)
  return url.replace(/\/$/, '')
}

/**
 * Run a live call, falling back to a fixture on any failure.
 *
 * Every adapter in this directory goes through here. Callers get an EgovResult
 * so the UI can honestly badge a panel as live vs. mock rather than silently
 * presenting fixture data as if it came from PhilSys.
 */
export async function callEgov<T>(
  service: EgovService,
  live: () => Promise<T>,
  mock: () => T,
): Promise<EgovResult<T>> {
  if (egovMode(service) === 'mock') {
    return { data: mock(), source: 'mock' }
  }

  try {
    return { data: await live(), source: 'live' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[egov:${service}] live call failed, serving fixture — ${message}`)
    return { data: mock(), source: 'fallback', error: message }
  }
}

// ------------------------------------------------------------------ tokens

type CachedToken = { token: string; expiresAt: number }

/**
 * Module-scope cache. Survives across requests within a warm serverless
 * instance and is simply re-fetched on a cold start — which is the correct
 * behaviour, not a limitation worth engineering around at this scale.
 */
const tokenCache = new Map<EgovService, CachedToken>()

/** 60s of headroom so a token can't expire mid-flight. */
const TOKEN_SKEW_MS = 60_000

export async function getAccessToken(
  service: EgovService,
  fetchToken: () => Promise<{ token: string; expiresInSeconds: number }>,
): Promise<string> {
  const cached = tokenCache.get(service)
  if (cached && cached.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return cached.token
  }

  const { token, expiresInSeconds } = await fetchToken()
  tokenCache.set(service, {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  })
  return token
}

export function clearTokenCache(service?: EgovService) {
  if (service) tokenCache.delete(service)
  else tokenCache.clear()
}

// ------------------------------------------------------------------- fetch

export class EgovHttpError extends Error {
  constructor(
    readonly service: EgovService,
    readonly status: number,
    readonly body: string,
    url: string,
  ) {
    super(`[${service}] ${status} ${url} — ${body.slice(0, 300)}`)
    this.name = 'EgovHttpError'
  }
}

/** Sandboxes can hang. Without a timeout a stalled call blocks the whole demo. */
const DEFAULT_TIMEOUT_MS = 15_000

export async function egovFetch<T>(
  service: EgovService,
  path: string,
  init: RequestInit & { timeoutMs?: number; baseUrl?: string } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, baseUrl, ...rest } = init
  const url = `${baseUrl ?? egovBaseUrl(service)}${path}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(rest.body && !(rest.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...rest.headers,
      },
      cache: 'no-store',
    })

    const text = await res.text()
    if (!res.ok) throw new EgovHttpError(service, res.status, text, url)

    return (text ? JSON.parse(text) : {}) as T
  } finally {
    clearTimeout(timer)
  }
}
