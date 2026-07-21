import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { listRequestsForLgu } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { RequestQueue } from './request-queue'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/console/requests')
  if (session.role !== 'officer' || !session.lguId) redirect('/console')
  const { data: officer } = await supabaseAdmin().from('officers').select('office').eq('egov_sub', session.sub).maybeSingle()
  const all = await listRequestsForLgu(session.lguId)
  const requests = officer?.office ? all.filter((r) => (r.service.approval_office ?? '').toLowerCase() === officer.office!.toLowerCase()) : all
  return <div className="space-y-6">
    <PageHeader eyebrow="Officer console" title="Approval queue" description={officer?.office ? `Requests routed to ${officer.office}` : 'All approval offices in your LGU'} />
    <Card><CardHeader title="Incoming requests" description={`${requests.length} request(s)`} /><CardBody className="p-0">{requests.length ? <RequestQueue initialRequests={requests} /> : <EmptyState title="No requests waiting" description="Paid or waived citizen requests will appear here." />}</CardBody></Card>
  </div>
}

