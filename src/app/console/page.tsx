import { redirect } from 'next/navigation'
import { ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { listServicesForLgu } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'

export default async function OfficerConsole() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/console')
  if (session.role !== 'officer') redirect('/')
  const lguId = session.lguId
  if (!lguId) redirect('/console/register')

  const db = supabaseAdmin()
  const { data: lgu } = await db.from('lgus').select('id, name').eq('id', lguId).maybeSingle()
  if (!lgu) redirect('/console/register')
  const services = await listServicesForLgu(lgu.id)
  const active = services.filter((service) => service.status === 'published')
  const flagged = services.filter((service) => service.status === 'flagged')

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Officer console" title={lgu.name} description={`${active.length} active eServices · ${flagged.length} awaiting DICT review`} action={<div className="flex flex-wrap gap-2"><ButtonLink href="/console/studio">Create eService with AI</ButtonLink><ButtonLink href="/console/requests" variant="secondary">Approval queue</ButtonLink><ButtonLink href="/console/analytics" variant="secondary">Analytics</ButtonLink></div>} />
      <Card>
        <CardHeader title="Configured eServices" description="Published services appear in the citizen catalog immediately; flagged services wait for DICT review." />
        <CardBody className="p-0">
          {services.length === 0 ? <div className="space-y-4 pb-5 text-center"><EmptyState title="0 configured eServices" description="This LGU is registered and ready. Create a DICT-bounded service in the AI Studio to begin." /><ButtonLink href="/console/studio">Open AI Studio</ButtonLink></div> : <ul className="divide-y divide-border">{services.map((service) => <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium">{service.template.name}</p><p className="text-xs text-muted">{service.approval_office ?? 'LGU approval office'} · {service.required_docs.length} required document{service.required_docs.length === 1 ? '' : 's'}</p></div><div className="flex items-center gap-2"><StatusBadge status={service.status} />{service.status === 'published' ? <ButtonLink href={`/citizen/lgus/${lgu.id}`} variant="ghost">Citizen view</ButtonLink> : null}</div></li>)}</ul>}
        </CardBody>
      </Card>
      <div className="flex justify-end"><ButtonLink href="/console/register" variant="ghost">Register a different LGU</ButtonLink></div>
    </div>
  )
}
