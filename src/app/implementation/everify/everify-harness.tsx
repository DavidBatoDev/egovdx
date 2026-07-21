'use client'

import { useState } from 'react'
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, Field, SourceBadge, inputClass } from '@/components/ui'

export function EverifyHarness({ mode, initialServiceId }: { mode: 'live' | 'mock'; initialServiceId: string }) {
  const [serviceId, setServiceId] = useState(initialServiceId)
  const [sessionId, setSessionId] = useState('mock-liveness-diagnostic')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function verify() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/everify/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, faceLivenessSessionId: sessionId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'eVerify request failed')
      setResult(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'eVerify request failed')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-5">
    <Card>
      <CardHeader title="Trigger" description="Sign in as a citizen first. In live mode, paste the session ID returned by the completed liveness SDK." action={<Badge tone={mode === 'live' ? 'success' : 'neutral'}>{mode} mode</Badge>} />
      <CardBody className="space-y-4">
        <Field label="Published service ID"><input className={inputClass} value={serviceId} onChange={(event) => setServiceId(event.target.value)} /></Field>
        <Field label="Face liveness session ID"><input className={inputClass} value={sessionId} onChange={(event) => setSessionId(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={verify}>{busy ? 'Verifying…' : 'Verify identity'}</Button><ButtonLink href="/signin?next=/implementation/everify" variant="secondary">Sign in as citizen</ButtonLink><ButtonLink href={`/apply/${serviceId}`} variant="ghost">Use complete citizen flow</ButtonLink></div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </CardBody>
    </Card>
    <Card>
      <CardHeader title="Raw result and source" action={result && typeof result.source === 'string' ? <SourceBadge source={result.source as 'live' | 'mock' | 'fallback'} /> : undefined} />
      <CardBody><pre className="max-h-96 overflow-auto rounded-lg bg-background p-4 text-xs">{result ? JSON.stringify(result, null, 2) : 'No result yet.'}</pre></CardBody>
    </Card>
  </div>
}
