'use client'

import { useState } from 'react'
import { Badge, Button, Card, CardBody, CardHeader, Field, PageHeader, SourceBadge, StatusBadge } from '@/components/ui'
import { peso } from '@/lib/format'
import type { FeeStatus, Waiver } from '@/lib/supabase/types'
import type { PaymentState } from '@/lib/payments/workflow'

export function PaymentClient({ requestId, serviceName, fee, waivers, initialStatus }: { requestId: string; serviceName: string; fee: number; waivers: Waiver[]; initialStatus: FeeStatus }) {
  const [selected, setSelected] = useState('')
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [status, setStatus] = useState<FeeStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function call(method: 'POST' | 'GET') {
    setLoading(true); setError(null)
    try {
      const response = await fetch(`/api/requests/${requestId}/payment`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ waiverCategory: selected || undefined }) : undefined })
      const body = (await response.json()) as PaymentState & { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Payment request failed.')
      setPayment(body); setStatus(body.feeStatus)
    } catch (err) { setError(err instanceof Error ? err.message : 'Payment request failed.') }
    finally { setLoading(false) }
  }

  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
    <PageHeader eyebrow="eGovPH citizen service" title={serviceName} description="Fee assessment and eGOV PAY checkout" action={<StatusBadge status={status} />} />
    <Card><CardHeader title="Fee assessment" action={<Badge tone="brand">{peso(payment?.feeDue ?? fee)}</Badge>} /><CardBody className="space-y-4">
      {waivers.length > 0 && status === 'unpaid' ? <Field label="Applicable waiver" hint="Optional"><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">No waiver</option>{waivers.map((w) => <option key={w.category} value={w.category}>{w.label}</option>)}</select></Field> : null}
      {payment?.source ? <SourceBadge source={payment.source} /> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {status === 'paid' || status === 'waived' ? <p className="rounded-lg bg-success-soft p-3 text-sm text-success">Fee requirement complete. This request is ready for officer review.</p> : payment?.checkoutUrl && payment.source === 'live' ? <a className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white" href={payment.checkoutUrl}>Continue to eGOV PAY</a> : payment ? <Button disabled={loading} onClick={() => call('GET')}>Confirm mock payment</Button> : <Button disabled={loading} onClick={() => call('POST')}>{loading ? 'Preparing…' : 'Assess fee'}</Button>}
    </CardBody></Card>
  </div>
}
