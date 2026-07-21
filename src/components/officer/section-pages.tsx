import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import type { Session } from '@/lib/auth/session'
import { listRequestsForLgu } from '@/lib/data'
import { peso } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/server'
import { RequestQueue } from './request-queue'
import { CreationHub } from './creation-hub'
import { AiInterviewClient } from './ai-interview-client'
import { ManualServiceClient } from './manual-service-client'
import { WebsiteEditor } from './website-editor'
import { getLguSiteEditorState } from '@/lib/lgu-site/data'
import { listServicesForLgu } from '@/lib/data'

export function OfficerStudioHub({ dashboardHref }: { dashboardHref: string }) {
  return <CreationHub baseHref={dashboardHref} />
}

export function OfficerAiStudio({ dashboardHref, lguId }: { dashboardHref: string; lguId: string }) {
  return <div className="space-y-6"><PageHeader eyebrow="Create eService" title="AI-assisted setup" description="OpenAI asks the practical questions an LGU needs to answer, while DICT rules remain the final authority." /><AiInterviewClient baseHref={dashboardHref} lguId={lguId} /></div>
}

export async function OfficerManualStudio({ dashboardHref, lguId, serviceId }: { dashboardHref: string; lguId: string; serviceId: string | null }) {
  const db = supabaseAdmin()
  const [{ data: templates, error: templateError }, serviceResult] = await Promise.all([
    db.from('service_templates').select('*').order('name'),
    serviceId ? db.from('lgu_services').select('*').eq('id', serviceId).eq('lgu_id', lguId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (templateError) throw templateError
  if (serviceResult.error) throw serviceResult.error
  if (serviceId && !serviceResult.data) throw new Error('SERVICE_NOT_FOUND')
  return <ManualServiceClient baseHref={dashboardHref} lguId={lguId} templates={templates ?? []} initial={serviceResult.data} />
}

export async function OfficerWebsite({ lguId }: { lguId: string }) {
  const db = supabaseAdmin()
  const [{ data: lgu, error }, state, allServices] = await Promise.all([
    db.from('lgus').select('id,name,type').eq('id', lguId).maybeSingle(),
    getLguSiteEditorState(lguId),
    listServicesForLgu(lguId),
  ])
  if (error) throw error
  if (!lgu) throw new Error('LGU_NOT_FOUND')
  const services = allServices.filter((service) => service.status === 'published')
  return <div className="space-y-6"><PageHeader eyebrow="LGU website" title="Website CMS" description="Brand your native eGovPH page, preview the complete citizen experience, then publish one safe snapshot." /><WebsiteEditor lgu={lgu} initialConfig={state.config} initialRevision={state.revision} publishedAt={state.publishedAt} services={services} /></div>
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
