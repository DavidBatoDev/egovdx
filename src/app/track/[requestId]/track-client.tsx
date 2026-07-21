'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader, SourceBadge, StatusBadge } from '@/components/ui'
import type { RequestWithService } from '@/lib/data'
import type { RequestEvent } from '@/lib/supabase/types'
import { dateOnly } from '@/lib/format'

const LABELS: Record<string, string> = { submitted: 'Application submitted', fee_waived: 'Fee waived', payment_status_checked: 'Payment checked', approved: 'Approved by issuing office', document_generated: 'Official PDF generated', hash_anchored: 'Document hash anchored on-chain', hash_unanchored: 'Document generated; chain anchoring pending', issued: 'Document issued', notification_sent: 'Citizen notified', rejected: 'Application rejected' }

export function TrackClient({ request, events }: { request: RequestWithService; events: RequestEvent[] }) {
  const router = useRouter()
  useEffect(() => { if (!['issued', 'rejected'].includes(request.status)) { const timer = setInterval(() => router.refresh(), 5000); return () => clearInterval(timer) } }, [request.status, router])
  const description = request.status === 'issued' ? 'Your official PDF is ready to download and verify.' : request.status === 'rejected' ? 'The issuing office returned this request.' : `Pending ${request.service.approval_office ?? 'LGU'} approval`
  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-8"><PageHeader eyebrow={request.service.lgu.name} title={request.service.template.name} description={description} action={<StatusBadge status={request.status} />} />
    <Card><CardHeader title="Request status" /><CardBody className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted">Fee</span><div><StatusBadge status={request.fee_status} /></div></div><div><span className="text-muted">Submitted</span><p>{dateOnly(request.created_at)}</p></div>{request.rejection_note ? <div className="sm:col-span-2"><span className="text-muted">Reason</span><p className="text-danger">{request.rejection_note}</p></div> : null}</CardBody></Card>
    <Card><CardHeader title="Timeline" /><CardBody><ol className="space-y-4 border-l-2 border-brand-soft pl-5">{events.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand" /><p className="font-bold">{LABELS[event.event] ?? event.event.replaceAll('_', ' ')}</p><p className="text-xs text-muted">{new Date(event.created_at).toLocaleString('en-PH')}</p></li>)}</ol></CardBody></Card>
    {request.chain_source ? <div className="flex items-center gap-2"><Badge tone="brand">Chain record</Badge><SourceBadge source={request.chain_source} /></div> : null}
    {request.status === 'issued' ? <div className="flex flex-wrap gap-3"><ButtonLink href={`/api/issue/download?id=${request.id}`}>Download PDF</ButtonLink><ButtonLink variant="secondary" href={`/verify/${request.id}`}>Verify document</ButtonLink></div> : null}
  </div>
}
