import { notFound } from 'next/navigation'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Badge, ButtonLink, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { listPublishedServices } from '@/lib/data'
import { peso } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function LguServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const services = (await listPublishedServices()).filter((service) => service.lgu.id === id)
  if (!services.length) notFound()
  return <CitizenShell active="/citizen/lgus"><PageHeader eyebrow="LGU services" title={services[0].lgu.name} description="Select a published service to start a verified online request." />{services.map((service) => <Card key={service.id}><CardHeader title={service.template.name} description={service.template.description} action={<Badge tone={service.fee_amount ? 'accent' : 'brand'}>{service.fee_amount ? peso(Number(service.fee_amount)) : 'No fee'}</Badge>} /><CardBody className="flex items-center justify-between gap-4"><p className="text-sm text-muted">{service.required_docs.length} required document{service.required_docs.length === 1 ? '' : 's'}</p><ButtonLink href={`/citizen/apply/${service.id}`}>Apply</ButtonLink></CardBody></Card>)}</CitizenShell>
}
