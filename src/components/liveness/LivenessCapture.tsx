'use client'

import Script from 'next/script'
import { useState } from 'react'
import { Badge, Button, SourceBadge } from '@/components/ui'

const SDK_URL =
  'https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js'

export type EverifyLivenessCapture = {
  /** Pass this exact value to eVerify as face_liveness_session_id. */
  sessionId: string
  photoUrl: string | null
  /** The documented SDK does not return confidence, so this is intentionally null. */
  livenessScore: null
  source: 'live' | 'mock'
}

type CaptureMode = 'live' | 'mock'

export function LivenessCapture({
  mode,
  onComplete,
}: {
  mode: CaptureMode
  onComplete?: (capture: EverifyLivenessCapture) => void
}) {
  const [sdkReady, setSdkReady] = useState(mode === 'mock')
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<EverifyLivenessCapture | null>(null)
  const [starting, setStarting] = useState(false)

  const reset = () => {
    setError(null)
    setCapture(null)
  }

  const start = async () => {
    reset()

    if (mode === 'mock') {
      const mockCapture: EverifyLivenessCapture = {
        sessionId: 'mock-everify-liveness-session',
        photoUrl: 'https://example.invalid/mock-liveness-photo.jpg',
        livenessScore: null,
        source: 'mock',
      }
      setCapture(mockCapture)
      onComplete?.(mockCapture)
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_EVERIFY_LIVENESS_PUBLIC_KEY
    if (!publicKey) {
      setError('NEXT_PUBLIC_EVERIFY_LIVENESS_PUBLIC_KEY is not configured.')
      return
    }
    if (!window.eKYC) {
      setError('The Face Liveness SDK did not load. Check your connection and try again.')
      return
    }

    setStarting(true)
    try {
      const response = await window.eKYC().start({ pubKey: publicKey })
      const sessionId = response.result?.session_id
      if (response.status !== 'COMPLETED' || !sessionId) {
        throw new Error('Face liveness did not complete. Please try again.')
      }

      const liveCapture: EverifyLivenessCapture = {
        sessionId,
        photoUrl: response.result?.photo_url ?? null,
        livenessScore: null,
        source: 'live',
      }
      setCapture(liveCapture)
      onComplete?.(liveCapture)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Face liveness was cancelled. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-4">
      {mode === 'live' ? (
        <Script
          src={SDK_URL}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setError('The Face Liveness SDK could not be loaded. Please try again.')}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">eVerify SDK</Badge>
        {capture ? <SourceBadge source={capture.source} /> : null}
        {mode === 'live' && !sdkReady ? <Badge tone="neutral">Loading SDK</Badge> : null}
      </div>

      <p className="text-sm text-muted">
        This session proves live capture for eVerify. The SDK documents a session ID, not a
        confidence score, so no score is invented or displayed.
      </p>

      {capture ? (
        <div className="rounded-lg border border-success/20 bg-success-soft p-4 text-sm">
          <p className="font-medium text-success">Face liveness capture completed</p>
          <p className="mt-1 break-all font-mono text-xs text-foreground">{capture.sessionId}</p>
          <p className="mt-2 text-xs text-muted">Ready to send as face_liveness_session_id.</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={start} disabled={starting || (mode === 'live' && !sdkReady)}>
          {starting ? 'Opening camera…' : capture || error ? 'Try again' : 'Start face liveness'}
        </Button>
        {(capture || error) && !starting ? (
          <Button type="button" variant="ghost" onClick={reset}>
            Clear result
          </Button>
        ) : null}
      </div>
    </div>
  )
}

type EkycResponse = {
  status?: string
  result?: {
    session_id?: string
    photo_url?: string
  }
}

declare global {
  interface Window {
    eKYC?: () => {
      start: (options: { pubKey: string }) => Promise<EkycResponse>
    }
  }
}
