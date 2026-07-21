import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { Badge, ButtonLink, Card, CardBody } from '@/components/ui'
import { listPublishedServices } from '@/lib/data'
import { peso } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function LguServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const services = (await listPublishedServices()).filter((service) => service.lgu.id === id)
  if (!services.length) notFound()
  return <CitizenShell active="/citizen/lgus"><div className="space-y-5"><Link href="/citizen/lgus" className="text-sm font-bold text-brand">← All LGUs</Link><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{services[0].lgu.type}</p><h1 className="mt-1 font-display text-3xl">{services[0].lgu.name}</h1><p className="mt-2 text-sm text-muted">Available services</p></div><div className="space-y-3">{services.map((service) => <Card key={service.id} className="rounded-xl bg-white"><CardBody className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><strong>{service.template.name}</strong>{service.template.description ? <p className="mt-1 text-sm text-muted">{service.template.description}</p> : null}</div><Badge tone={service.fee_amount ? 'accent' : 'brand'}>{service.fee_amount ? peso(Number(service.fee_amount)) : 'Free'}</Badge></div><div className="flex items-center justify-between"><p className="text-xs text-muted">{service.required_docs.length} document{service.required_docs.length === 1 ? '' : 's'} required</p><ButtonLink href={`/citizen/apply/${service.id}`}>Apply</ButtonLink></div></CardBody></Card>)}</div></div></CitizenShell>
}
