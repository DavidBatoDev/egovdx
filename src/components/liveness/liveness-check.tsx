'use client'

import { useState } from 'react'
import Script from 'next/script'
import { Button, SourceBadge, Toast } from '@/components/ui'

export function LivenessCheck({ requestId, mock, onVerified }: { requestId: string; mock: boolean; onVerified: (identity: Record<string, unknown>, source: 'live' | 'mock') => void }) {
  const [ready, setReady] = useState(mock)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function begin() {
    setBusy(true); setError(null)
    try {
      let sessionId: string
      if (mock) sessionId = `mock-liveness-${requestId}`
      else {
        const pubKey = process.env.NEXT_PUBLIC_EVERIFY_LIVENESS_PUBLIC_KEY
        if (!pubKey || !window.eKYC) throw new Error('The eVerify liveness SDK is unavailable.')
        const response = await window.eKYC().start({ pubKey })
        sessionId = response.result?.session_id ?? ''
        if (response.status !== 'COMPLETED' || !sessionId) throw new Error('Liveness was not completed.')
      }
      const response = await fetch(`/api/applications/${requestId}/identity`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Identity verification failed.')
      onVerified(body.identity, body.source)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Identity verification failed.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-4">
    {!mock ? <Script src="https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError('The eVerify liveness SDK could not be loaded.')} /> : null}
    {mock ? <SourceBadge source="mock" /> : null}
    <p className="text-sm text-muted">The camera check confirms a live person is present. eVerify then retrieves the matching government identity record.</p>
    {error ? <Toast tone="danger">{error}</Toast> : null}
    <Button type="button" disabled={!ready || busy} onClick={begin}>{busy ? 'Verifying…' : 'Start face liveness check'}</Button>
  </div>
}
