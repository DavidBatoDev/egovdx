'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DynamicForm } from '@/components/form/dynamic-form'
import { LivenessCheck } from '@/components/liveness/liveness-check'
import { Badge, Button, Card, CardBody, CardHeader, Field, FileUpload, PageHeader, SourceBadge, Stepper, Toast, inputClass } from '@/components/ui'
import type { RequestWithService } from '@/lib/data'
import type { UploadedDocument } from '@/lib/supabase/types'
import { peso } from '@/lib/format'

const STEPS = ['Verify', 'Form', 'Documents', 'Fee', 'Submit']

export function ApplicationClient({ draft, identityMock }: { draft: RequestWithService; identityMock: boolean }) {
  const router = useRouter()
  const existingIdentity = draft.everify_payload as Record<string, unknown> | null
  const [step, setStep] = useState(existingIdentity ? 1 : 0)
  const [identity, setIdentity] = useState(existingIdentity)
  const [source, setSource] = useState<'live' | 'mock'>((existingIdentity?.source === 'live' ? 'live' : 'mock'))
  const [documents, setDocuments] = useState<UploadedDocument[]>(Array.isArray(draft.uploaded_docs) ? draft.uploaded_docs as UploadedDocument[] : [])
  const [feeStatus, setFeeStatus] = useState(draft.fee_status)
  const [selectedWaiver, setSelectedWaiver] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const prefill = useMemo(() => {
    const result: Record<string, string | number> = {}
    for (const field of draft.service.form_fields) {
      const key = field.key.toLowerCase()
      if (key.includes('name')) result[field.key] = String(identity?.fullName ?? identity?.full_name ?? draft.citizen_name ?? '')
      else if (key.includes('address')) result[field.key] = String(identity?.address ?? identity?.full_address ?? '')
      else if (key.includes('birth')) result[field.key] = String(identity?.birthdate ?? identity?.birth_date ?? '')
    }
    return result
  }, [draft, identity])

  async function json(url: string, init: RequestInit) {
    setBusy(true); setError(null); setMessage(null)
    try {
      const response = await fetch(url, init)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.')
      return body
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed.'); throw cause }
    finally { setBusy(false) }
  }

  async function saveForm(formData: Record<string, unknown>) {
    try { await json(`/api/applications/${draft.id}/form`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formData }) }); setStep(2) } catch {}
  }

  async function upload(requirement: string, file: File | null) {
    if (!file) return
    const form = new FormData(); form.set('requirement', requirement); form.set('file', file)
    try { const body = await json(`/api/applications/${draft.id}/documents`, { method: 'POST', body: form }); setDocuments(body.documents); setMessage(`${requirement} uploaded.`) } catch {}
  }

  async function assessFee(confirm = false) {
    try {
      const body = await json(`/api/requests/${draft.id}/payment`, { method: confirm ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: confirm ? undefined : JSON.stringify({ waiverCategory: selectedWaiver || undefined }) })
      setFeeStatus(body.feeStatus)
      if (body.checkoutUrl && body.source === 'live') window.location.assign(body.checkoutUrl)
      else if (body.feeStatus === 'paid' || body.feeStatus === 'waived') setStep(4)
      else setMessage('Mock checkout prepared. Confirm it to continue.')
    } catch {}
  }

  async function submit() {
    try { const body = await json(`/api/applications/${draft.id}/submit`, { method: 'POST' }); router.push(`/track/${body.requestId}`) } catch {}
  }

  const documentsComplete = draft.service.required_docs.every((required) => documents.some((document) => document.requirement === required))
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <PageHeader eyebrow={`${draft.service.lgu.name} · eGovPH service`} title={draft.service.template.name} description="Your verified identity is reused, so you only provide information government does not already hold." action={<Badge tone="brand">Draft</Badge>} />
    <Stepper steps={STEPS} current={step} />
    {error ? <Toast tone="danger">{error}</Toast> : null}{message ? <Toast>{message}</Toast> : null}
    {step === 0 ? <Card><CardHeader title="Verify your identity" /><CardBody><LivenessCheck requestId={draft.id} mock={identityMock} onVerified={(value, identitySource) => { setIdentity(value); setSource(identitySource); setStep(1) }} /></CardBody></Card> : null}
    {step === 1 ? <Card><CardHeader title="Application form" action={<SourceBadge source={source} />} /><CardBody><DynamicForm fields={draft.service.form_fields} prefill={prefill} onSubmit={saveForm} /></CardBody></Card> : null}
    {step === 2 ? <Card><CardHeader title="Required documents" description="PDF, JPEG, or PNG · maximum 4 MB each" /><CardBody className="space-y-4">{draft.service.required_docs.length === 0 ? <p className="text-sm text-muted">No supporting documents are required.</p> : draft.service.required_docs.map((requirement) => <Field key={requirement} label={requirement} hint={documents.some((document) => document.requirement === requirement) ? <Badge tone="success">Uploaded</Badge> : undefined}><FileUpload accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => upload(requirement, event.target.files?.[0] ?? null)} /></Field>)}<Button disabled={!documentsComplete} onClick={() => setStep(3)}>Continue to fee</Button></CardBody></Card> : null}
    {step === 3 ? <Card><CardHeader title="Fee assessment" action={<Badge tone="accent">{peso(Number(draft.service.fee_amount))}</Badge>} /><CardBody className="space-y-4">{draft.service.waivers.length ? <Field label="Applicable waiver" hint="Optional"><select className={inputClass} value={selectedWaiver} onChange={(event) => setSelectedWaiver(event.target.value)}><option value="">No waiver</option>{draft.service.waivers.map((waiver) => <option key={waiver.category} value={waiver.category}>{waiver.label}</option>)}</select></Field> : null}<p className="text-sm text-muted">Status: <strong>{feeStatus}</strong></p><Button disabled={busy} onClick={() => assessFee(false)}>Assess fee</Button>{message?.includes('Mock checkout') ? <Button variant="secondary" disabled={busy} onClick={() => assessFee(true)}>Confirm mock payment</Button> : null}</CardBody></Card> : null}
    {step === 4 ? <Card><CardHeader title="Submit application" /><CardBody className="space-y-4"><p className="text-sm">Your verified application will be routed to <strong>{draft.service.approval_office ?? 'the issuing LGU office'}</strong>.</p><Button disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit request'}</Button></CardBody></Card> : null}
  </main>
}
