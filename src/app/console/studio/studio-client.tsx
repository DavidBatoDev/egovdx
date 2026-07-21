'use client'

import { useState } from 'react'
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, Field, SourceBadge, inputClass } from '@/components/ui'

type Finding = { ruleCode: string; severity: 'warn' | 'block'; message: string; fieldPath: string | null }
type Result = {
  generation: { data: unknown; source: 'live' | 'mock' | 'fallback'; engine: string; model: string; cacheHit: boolean }
  flags: Finding[]
  credits: number | null
  extraction?: unknown
}
type SavedResult = { status: 'published' | 'flagged'; serviceId: string }

export default function StudioClient({ harness = false }: { harness?: boolean }) {
  const [prompt, setPrompt] = useState('Create a tricycle franchise renewal for Marilao. Charge ₱300 and require OR/CR and barangay clearance.')
  const [result, setResult] = useState<Result | null>(null)
  const [schema, setSchema] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<SavedResult | null>(null)

  async function request(url: string, body: BodyInit) {
    setBusy(true); setError(''); setSaved(null)
    try {
      const response = await fetch(url, { method: 'POST', body, headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Request failed')
      setResult(json)
      setSchema(JSON.stringify(json.generation.data, null, 2))
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  async function confirm() {
    if (!result) return
    setBusy(true); setError('')
    try {
      const service = JSON.parse(schema)
      const response = await fetch('/api/studio/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service, engine: result.generation.engine, model: result.generation.model, sourcePrompt: prompt, generatedBy: result.extraction ? 'upload' : 'ai' }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Save failed')
      setSaved(json as SavedResult)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <Card><CardHeader title="1. Describe or upload the service" description="Generation creates a preview only. Nothing is saved until you confirm." />
      <CardBody className="space-y-4">
        <Field label="Natural-language request"><textarea className={`${inputClass} min-h-28`} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => request('/api/studio/generate', JSON.stringify({ prompt }))}>{busy ? 'Working…' : 'Generate preview'}</Button>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-brand-soft">Upload blank form<input className="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('file', file); void request('/api/studio/extract', data) }} /></label></div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </CardBody></Card>
    {result ? <>
      <Card><CardHeader title="2. Provider and validation" action={<div className="flex gap-2"><SourceBadge source={result.generation.source} /><Badge tone="brand">{result.generation.engine}</Badge></div>} />
        <CardBody className="space-y-3 text-sm"><p>Model: <code>{result.generation.model}</code> · Cache: {result.generation.cacheHit ? 'hit' : 'miss'} · Credits: {result.credits ?? 'unavailable'}</p>
          {result.flags.length ? <ul className="space-y-2">{result.flags.map((flag) => <li key={`${flag.ruleCode}-${flag.fieldPath}`} className="rounded-lg bg-warn-soft p-3"><strong>{flag.severity.toUpperCase()}</strong> · {flag.ruleCode}: {flag.message}</li>)}</ul> : <p className="rounded-lg bg-success-soft p-3 text-success">No validation findings. This service can publish after confirmation.</p>}
        </CardBody></Card>
      <Card><CardHeader title="3. Inspect and edit the generated schema" description="The same schema is revalidated server-side when confirmed." />
        <CardBody><textarea aria-label="Generated service schema" className={`${inputClass} min-h-96 font-mono text-xs`} value={schema} onChange={(event) => setSchema(event.target.value)} /></CardBody></Card>
      {!harness ? <Card><CardHeader title="4. Officer confirmation" description="One atomic save writes the service and validation findings." />
        <CardBody className="space-y-4"><div className="flex items-center gap-4"><Button disabled={busy || Boolean(saved)} onClick={confirm}>{saved ? 'Confirmed' : 'Confirm and submit'}</Button>{saved ? <p className="text-sm"><strong>{saved.status === 'published' ? 'Published for citizens' : 'Sent to DICT review'}</strong> · service {saved.serviceId}</p> : null}</div>{saved ? <div className="flex flex-wrap gap-2"><ButtonLink href="/console" variant="secondary">Back to dashboard</ButtonLink>{saved.status === 'published' ? <ButtonLink href="/citizen/services">View citizen catalog</ButtonLink> : <ButtonLink href="/review" variant="ghost">Review queue details</ButtonLink>}</div> : null}</CardBody></Card> : null}
      {harness ? <Card><CardHeader title="Raw result" /><CardBody><pre className="overflow-auto rounded-lg bg-background p-4 text-xs">{JSON.stringify(result, null, 2)}</pre></CardBody></Card> : null}
    </> : null}
  </div>
}
