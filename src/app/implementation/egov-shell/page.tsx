import { CitizenShell } from '@/components/shell/citizen-shell'
import { Badge, Card, CardBody, PageHeader } from '@/components/ui'
import { listPublishedServices } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ShellHarness() {
  const services = await listPublishedServices()
  return <div className="space-y-6"><PageHeader eyebrow="Jasmin · implementation harness" title="Native eGovPH LGU shell" description="Reads the current published-service catalog directly from Supabase." /><CitizenShell active="/citizen/lgus"><div className="flex items-center justify-between"><strong>Raw result</strong><Badge tone="brand">{services.length} published</Badge></div>{services.slice(0, 4).map((service) => <Card key={service.id}><CardBody><strong>{service.template.name}</strong><p className="text-sm text-muted">{service.lgu.name}</p></CardBody></Card>)}</CitizenShell><Card><CardBody><p className="text-xs">Source: live application database · Export: <code>CitizenShell</code> and dynamic LGU navigation.</p></CardBody></Card></div>
}
