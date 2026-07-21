'use client'

import { useState } from 'react'
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, Field, SourceBadge, inputClass } from '@/components/ui'
import type { GeneratedService } from '@/lib/studio/generate'

type Finding = { ruleCode: string; severity: 'warn' | 'block'; message: string; fieldPath: string | null }
type Result = {
  generation: { data: GeneratedService; source: 'live' | 'mock' | 'fallback'; engine: string; model: string; cacheHit: boolean }
  flags: Finding[]
  credits: number | null
  extraction?: unknown
}
type SavedResult = { status: 'published' | 'flagged'; serviceId: string }

export default function StudioClient({ harness = false, dashboardHref = '/lgu' }: { harness?: boolean; dashboardHref?: string }) {
  const [prompt, setPrompt] = useState('Create a tricycle franchise renewal for Marilao. Charge ₱300 and require OR/CR and barangay clearance.')
  const [template, setTemplate] = useState<File | null>(null)
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

  function generateFromTemplate() {
    if (!prompt.trim()) {
      setError('Describe the eService first.')
      return
    }
    if (!template) {
      setError('Upload the DOCX or PDF template that the AI should map.')
      return
    }
    const data = new FormData()
    data.append('prompt', prompt)
    data.append('file', template)
    void request('/api/studio/extract', data)
  }

  return <div className="space-y-5">
    <Card><CardHeader title="1. Describe the eService and add its template" description="Both are required: your instructions set the policy; the DOCX or PDF preserves the local form. Nothing is saved until you confirm." />
      <CardBody className="space-y-4">
        <Field label="Natural-language request" required hint="Describe the service, requirements, fee, and approving office."><textarea className={`${inputClass} min-h-36`} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></Field>
        <Field label="Permit or eService template" required hint="DOCX or PDF · up to 4 MB. The AI extracts the local fields and layout."><label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-background px-4 text-center hover:border-brand hover:bg-brand-soft"><span className="font-semibold text-brand">{template ? template.name : 'Upload a DOCX or PDF'}</span><span className="text-xs text-muted">{template ? `${Math.ceil(template.size / 1024)} KB selected` : 'Choose the existing form your citizens use today.'}</span><input className="sr-only" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf" onChange={(event) => setTemplate(event.target.files?.[0] ?? null)} /></label></Field>
        <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || !prompt.trim() || !template} onClick={generateFromTemplate}>{busy ? 'Mapping template…' : 'Generate eService'}</Button><p className="text-sm text-muted">Government-held identity details are marked for automatic eVerify prefill; citizens only complete local requirements.</p></div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </CardBody></Card>
    {result ? <>
      <Card><CardHeader title="2. Provider and validation" action={<div className="flex gap-2"><SourceBadge source={result.generation.source} /><Badge tone="brand">{result.generation.engine}</Badge></div>} />
        <CardBody className="space-y-3 text-sm"><p>Model: <code>{result.generation.model}</code> · Cache: {result.generation.cacheHit ? 'hit' : 'miss'} · Credits: {result.credits ?? 'unavailable'}</p>
          {result.flags.length ? <ul className="space-y-2">{result.flags.map((flag) => <li key={`${flag.ruleCode}-${flag.fieldPath}`} className="rounded-lg bg-warn-soft p-3"><strong>{flag.severity.toUpperCase()}</strong> · {flag.ruleCode}: {flag.message}</li>)}</ul> : <p className="rounded-lg bg-success-soft p-3 text-success">No validation findings. This service can publish after confirmation.</p>}
        </CardBody></Card>
      <Card><CardHeader title="3. Service setup preview" description="The AI uses the template and your instructions; citizens are only asked for information that eGovPH does not already hold." />
        <CardBody className="grid gap-4 md:grid-cols-2"><div className="rounded-md bg-background p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Citizen provides</p><ul className="mt-3 space-y-2 text-sm">{result.generation.data.formFields.filter((field) => field.source !== 'everify').map((field) => <li key={field.key}>{field.required ? <span className="text-danger">• </span> : <span>• </span>}{field.label}</li>)}{result.generation.data.formFields.every((field) => field.source === 'everify') ? <li className="text-muted">No additional form details required.</li> : null}</ul></div><div className="rounded-md bg-brand-soft p-4"><p className="text-xs font-bold uppercase tracking-wide text-brand">Fetched automatically</p><ul className="mt-3 space-y-2 text-sm">{result.generation.data.formFields.filter((field) => field.source === 'everify').map((field) => <li key={field.key}>• {field.label}</li>)}{result.generation.data.formFields.every((field) => field.source !== 'everify') ? <li className="text-muted">No government profile fields are needed by this template.</li> : null}</ul></div><div className="rounded-md border border-border p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Required supporting documents</p><p className="mt-3 text-sm">{result.generation.data.requiredDocs.length ? result.generation.data.requiredDocs.join(' · ') : 'None'}</p></div><div className="rounded-md border border-border p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Fee and routing</p><p className="mt-3 text-sm">₱{result.generation.data.feeAmount.toLocaleString('en-PH')} fixed fee · {result.generation.data.approvalOffice ?? 'LGU approval office'}</p></div></CardBody></Card>
      {!harness ? <Card><CardHeader title="4. Officer confirmation" description="One atomic save writes the service and validation findings." />
        <CardBody className="space-y-4"><div className="flex items-center gap-4"><Button disabled={busy || Boolean(saved)} onClick={confirm}>{saved ? 'Confirmed' : 'Confirm and submit'}</Button>{saved ? <p className="text-sm"><strong>{saved.status === 'published' ? 'Published for citizens' : 'Sent to DICT review'}</strong> · service {saved.serviceId}</p> : null}</div>{saved ? <div className="flex flex-wrap gap-2"><ButtonLink href={dashboardHref} variant="secondary">Back to dashboard</ButtonLink>{saved.status === 'published' ? <ButtonLink href="/citizen/services">View citizen catalog</ButtonLink> : <ButtonLink href="/review" variant="ghost">Review queue details</ButtonLink>}</div> : null}</CardBody></Card> : null}
      {harness ? <Card><CardHeader title="Raw result" /><CardBody><pre className="overflow-auto rounded-lg bg-background p-4 text-xs">{JSON.stringify(result, null, 2)}</pre></CardBody></Card> : null}
    </> : null}
  </div>
}
