'use client'

import { useState } from 'react'
import { Badge, Button, ButtonLink, SourceBadge, StatusBadge } from '@/components/ui'
import type { RequestWithService } from '@/lib/data'

export function RequestQueue({ initialRequests }: { initialRequests: RequestWithService[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function mutate(id: string, action: 'approve' | 'reject') {
    const note = action === 'reject' ? window.prompt('Required rejection note:')?.trim() : undefined
    if (action === 'reject' && !note) return
    setBusy(id)
    setError(null)
    try {
      const response = await fetch(`/api/requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note ? { note } : {}),
      })
      const body = (await response.json()) as {
        error?: string
        status?: string
        controlNumber?: string
        chainSource?: 'live' | 'mock' | 'fallback'
        smsStatus?: string
        smsSource?: 'live' | 'mock' | 'fallback' | null
      }
      if (!response.ok) throw new Error(body.error ?? `${action} failed`)
      setRequests((items) => items.map((item) => item.id === id ? {
        ...item,
        status: body.status === 'issued' ? 'issued' : action === 'reject' ? 'rejected' : 'approved',
        control_number: body.controlNumber ?? item.control_number,
        chain_source: body.chainSource ?? item.chain_source,
        sms_status: (body.smsStatus as RequestWithService['sms_status']) ?? item.sms_status,
        sms_source: body.smsSource ?? item.sms_source,
      } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${action} failed`)
    } finally {
      setBusy(null)
    }
  }

  async function retrySms(id: string) {
    const note = window.prompt('Required reason for retrying an uncertain notification:')?.trim()
    if (!note) return
    setBusy(id)
    setError(null)
    try {
      const response = await fetch(`/api/requests/${id}/notification/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      const body = (await response.json()) as { error?: string; status?: RequestWithService['sms_status'] }
      if (!response.ok) throw new Error(body.error ?? 'Notification retry failed')
      setRequests((items) => items.map((item) => item.id === id ? { ...item, sms_status: body.status ?? item.sms_status } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Notification retry failed')
    } finally {
      setBusy(null)
    }
  }

  return <div className="divide-y divide-border">
    {error ? <p role="alert" className="m-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
    {requests.map((request) => {
      const approvable = request.status === 'submitted' && request.liveness_passed && (request.liveness_score == null || request.liveness_score >= 95) && ['paid', 'waived'].includes(request.fee_status)
      return <article key={request.id} className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">{request.service.template.name}</h3><p className="text-sm text-muted">{request.citizen_name ?? 'Citizen'} · {request.service.approval_office ?? 'LGU office'}</p></div>
          <div className="flex gap-2"><StatusBadge status={request.status} /><StatusBadge status={request.fee_status} /></div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted">Liveness</p><p>{request.liveness_passed ? `${request.liveness_score ?? 'Passed'}${request.liveness_score ? '%' : ''}` : 'Not passed'}</p></div>
          <div><p className="text-xs text-muted">eVerify reference</p><p className="font-mono text-xs">{request.everify_reference ?? '—'}</p></div>
          <div><p className="text-xs text-muted">Payment reference</p><p className="font-mono text-xs">{request.payment_ref ?? request.waiver_applied ?? '—'}</p></div>
        </div>
        <details><summary className="cursor-pointer text-sm font-medium text-brand">Review submitted evidence</summary><pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-background p-3 text-xs">{JSON.stringify({ formData: request.form_data, uploadedDocuments: request.uploaded_docs, eVerify: request.everify_payload }, null, 2)}</pre></details>
        {request.control_number ? <div className="rounded-lg bg-success-soft p-3 text-sm text-success"><strong>Issued:</strong> {request.control_number}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          {request.chain_source ? <><Badge tone="brand">Chain</Badge><SourceBadge source={request.chain_source} /></> : null}
          {request.sms_source ? <><Badge tone="brand">SMS</Badge><SourceBadge source={request.sms_source} /></> : null}
          {request.status === 'issued' ? <StatusBadge status={request.sms_status} /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!approvable || busy === request.id} onClick={() => mutate(request.id, 'approve')}>{busy === request.id ? 'Working…' : 'Approve and issue'}</Button>
          <Button variant="danger" disabled={request.status !== 'submitted' || busy === request.id} onClick={() => mutate(request.id, 'reject')}>Reject</Button>
          {['failed', 'unknown'].includes(request.sms_status) ? <Button variant="secondary" disabled={busy === request.id} onClick={() => retrySms(request.id)}>Retry SMS with note</Button> : null}
          {!approvable && request.status === 'submitted' ? <Badge tone="warn">Complete payment and identity checks first</Badge> : null}
        </div>
        {request.status === 'issued' ? <div className="flex flex-wrap gap-2"><ButtonLink href={`/api/issue/download?id=${request.id}`}>Download issued PDF</ButtonLink><ButtonLink href={`/verify/${request.id}`} variant="secondary">Open public verification</ButtonLink></div> : null}
      </article>
    })}
  </div>
}
