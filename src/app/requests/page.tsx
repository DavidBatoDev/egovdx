import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Card, CardBody, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { listRequestsForCitizen } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function CitizenRequestsPage() {
  const session = await getSession(); if (!session) redirect('/signin?next=/requests'); if (session.role !== 'citizen') redirect('/')
  const requests = await listRequestsForCitizen(session.sub)
  return <CitizenShell active="/requests"><PageHeader eyebrow="My requests" title="Applications and issued documents" />{requests.length ? requests.map((request) => <Link key={request.id} href={request.status === 'draft' ? `/apply/${request.lgu_service_id}` : `/track/${request.id}`}><Card className="hover:border-brand"><CardBody className="flex items-center justify-between gap-4"><div><strong>{request.service.template.name}</strong><p className="text-sm text-muted">{request.service.lgu.name}</p></div><StatusBadge status={request.status} /></CardBody></Card></Link>) : <Card><EmptyState title="No applications yet" description="Browse LGUs to request a service." /></Card>}</CitizenShell>
}
