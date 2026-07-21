import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Card, CardBody, EmptyState, StatusBadge } from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { listRequestsForCitizen } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function CitizenRequestsPage() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/citizen/requests')
  if (session.role !== 'citizen') redirect('/')
  const requests = await listRequestsForCitizen(session.sub)
  return <CitizenShell active="/citizen/requests"><div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Activity</p><h1 className="mt-1 font-display text-3xl">My requests</h1><p className="mt-2 text-sm text-muted">Track your local government applications and issued documents.</p></div>{requests.length ? <div className="space-y-3">{requests.map((request) => <Link key={request.id} href={request.status === 'draft' ? `/citizen/apply/${request.lgu_service_id}` : `/citizen/track/${request.id}`} className="block"><Card className="rounded-xl bg-white hover:border-brand"><CardBody className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><strong className="block truncate">{request.service.template.name}</strong><p className="mt-1 truncate text-sm text-muted">{request.service.lgu.name}</p></div><StatusBadge status={request.status} /></CardBody></Card></Link>)}</div> : <Card className="rounded-xl"><EmptyState title="No applications yet" description="Open LGUs to request your first local government service." /></Card>}</div></CitizenShell>
}
