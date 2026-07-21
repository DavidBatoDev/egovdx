import { redirect } from 'next/navigation'
import { ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { listServicesForLgu } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'

export default async function OfficerConsole({ searchParams }: { searchParams: Promise<{ lgu?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/signin?next=/console')
  if (session.role !== 'officer') redirect('/')
  const { lgu: registeredLguId } = await searchParams
  const lguId = registeredLguId ?? session.lguId
  if (!lguId) redirect('/console/register')

  const db = supabaseAdmin()
  const { data: lgu } = await db.from('lgus').select('id, name').eq('id', lguId).maybeSingle()
  if (!lgu) redirect('/console/register')
  const services = await listServicesForLgu(lgu.id)
  const active = services.filter((service) => service.status === 'published')

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Officer console" title={lgu.name} description={`${active.length} active eServices`} action={<ButtonLink href="/console/register" variant="secondary">Register another LGU</ButtonLink>} />
      <Card>
        <CardHeader title="Active eServices" />
        <CardBody className="p-0">
          {active.length === 0 ? <EmptyState title="0 active eServices" description="This LGU is registered and ready. Create a DICT-bounded service in the AI Studio to begin." /> : <ul className="divide-y divide-border">{active.map((service) => <li key={service.id} className="px-5 py-4 text-sm font-medium">{service.template.name}</li>)}</ul>}
        </CardBody>
      </Card>
    </div>
  )
}
