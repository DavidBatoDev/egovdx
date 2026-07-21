'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardBody, CardHeader, SourceBadge } from '@/components/ui'
import { LivenessCapture, type EverifyLivenessCapture } from './LivenessCapture'

type EgovSource = 'live' | 'mock' | 'fallback'

type StandaloneSession = {
  sessionToken: string
  redirectUrl: string | null
}

type StandaloneResult = {
  sessionToken: string
  passed: boolean
  confidence: number | null
  status: 'pending' | 'passed' | 'failed'
}

type ApiResult<T> = {
  data: T
  source: EgovSource
  error?: string
}

export function FaceLivenessHarness({ mode }: { mode: 'live' | 'mock' }) {
  const [sdkCapture, setSdkCapture] = useState<EverifyLivenessCapture | null>(null)
  const [standaloneSession, setStandaloneSession] = useState<ApiResult<StandaloneSession> | null>(null)
  const [standaloneResult, setStandaloneResult] = useState<ApiResult<StandaloneResult> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const createStandaloneSession = async () => {
    setLoading(true)
    setError(null)
    setStandaloneResult(null)
    try {
      const response = await fetch('/api/liveness/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', delay: 0 }),
      })
      const body = (await response.json()) as ApiResult<StandaloneSession> | { error?: string }
      if (!response.ok || !('data' in body)) {
        throw new Error('error' in body && body.error ? body.error : 'Unable to create liveness session')
      }
      setStandaloneSession(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create liveness session')
    } finally {
      setLoading(false)
    }
  }

  const checkStandaloneResult = async () => {
    if (!standaloneSession) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/liveness/${encodeURIComponent(standaloneSession.data.sessionToken)}`,
      )
      const body = (await response.json()) as ApiResult<StandaloneResult> | { error?: string }
      if (!response.ok || !('data' in body)) {
        throw new Error('error' in body && body.error ? body.error : 'Unable to check liveness result')
      }
      setStandaloneResult(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to check liveness result')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Citizen capture — eVerify Face Liveness SDK"
          description="The session ID from this capture is the only liveness value passed to eVerify."
          action={<Badge tone={mode === 'mock' ? 'neutral' : 'success'}>{mode} mode</Badge>}
        />
        <CardBody>
          <LivenessCapture mode={mode} onComplete={setSdkCapture} />
          {sdkCapture ? (
            <pre className="mt-4 overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs">
              {JSON.stringify(sdkCapture, null, 2)}
            </pre>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Standalone REST audit"
          description="A separate API integration: its token and score are never supplied to eVerify."
          action={standaloneResult ? <SourceBadge source={standaloneResult.source} /> : undefined}
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">
            Accepted only when the API returns SUCCEEDED with confidence at least 95.0.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={createStandaloneSession} disabled={loading}>
              {loading ? 'Working…' : 'Create standalone session'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={checkStandaloneResult}
              disabled={loading || !standaloneSession}
            >
              Check result
            </Button>
          </div>

          {standaloneSession ? (
            <pre className="overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs">
              {JSON.stringify(standaloneSession, null, 2)}
            </pre>
          ) : null}
          {standaloneResult ? (
            <pre className="overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs">
              {JSON.stringify(standaloneResult, null, 2)}
            </pre>
          ) : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </CardBody>
      </Card>
    </div>
  )
}
