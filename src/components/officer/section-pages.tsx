import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import type { Session } from '@/lib/auth/session'
import { listRequestsForLgu } from '@/lib/data'
import { peso } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/server'
import { RequestQueue } from './request-queue'
import StudioClient from './studio-client'

export function OfficerStudio({ dashboardHref }: { dashboardHref: string }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="LGU workspace" title="AI eService Studio" description="Draft inside DICT-approved bounds, inspect every field, then publish or route anomalies for review." />
      <StudioClient dashboardHref={dashboardHref} />
    </div>
  )
}

export async function OfficerRequests({ session }: { session: Session }) {
  const { data: officer } = await supabaseAdmin()
    .from('officers')
    .select('office')
    .eq('egov_sub', session.sub)
    .maybeSingle()
  const all = await listRequestsForLgu(session.lguId!)
  const requests = officer?.office
    ? all.filter((request) => (request.service.approval_office ?? '').toLowerCase() === officer.office!.toLowerCase())
    : all

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="LGU workspace" title="Approval queue" description={officer?.office ? `Requests routed to ${officer.office}` : 'All approval offices in your LGU'} />
      <Card>
        <CardHeader title="Incoming requests" description={`${requests.length} request(s)`} />
        <CardBody className="p-0">
          {requests.length ? <RequestQueue initialRequests={requests} /> : <EmptyState title="No requests waiting" description="Paid or waived citizen requests will appear here." />}
        </CardBody>
      </Card>
    </div>
  )
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader title={title} /><CardBody><p className="text-2xl font-semibold">{value}</p></CardBody></Card>
}

export async function OfficerAnalytics({ session }: { session: Session }) {
  const requests = await listRequestsForLgu(session.lguId!)
  const issued = requests.filter((request) => request.status === 'issued')
  const durations = issued
    .filter((request) => request.issued_at)
    .map((request) => new Date(request.issued_at!).getTime() - new Date(request.created_at).getTime())
  const medianMs = median(durations)
  const paid = requests.filter((request) => request.fee_status === 'paid').reduce((sum, request) => sum + Number(request.fee_due), 0)
  const waived = requests.filter((request) => request.fee_status === 'waived').length

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="LGU workspace" title="Service analytics" description="LGU-scoped operational outcomes" />
      {requests.length === 0 ? (
        <Card><EmptyState title="No request data yet" description="Metrics will appear after citizens submit services." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Metric title="Requests" value={String(requests.length)} />
          <Metric title="Completion rate" value={`${Math.round(issued.length / requests.length * 100)}%`} />
          <Metric title="Median issue time" value={medianMs == null ? '—' : `${Math.round(medianMs / 60000)} min`} />
          <Metric title="Fees" value={`${peso(paid)} · ${waived} waived`} />
        </div>
      )}
    </div>
  )
}
