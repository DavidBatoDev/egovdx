import Link from 'next/link'
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from '@/components/ui'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { listPublishedServices, type PublishedService } from '@/lib/data'
import { peso } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  let services: PublishedService[] = []
  let dbError: string | null = null

  try {
    services = await listPublishedServices()
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error)
  }

  const byLgu = new Map<string, PublishedService[]>()
  for (const service of services) {
    const existing = byLgu.get(service.lgu.id)
    if (existing) existing.push(service)
    else byLgu.set(service.lgu.id, [service])
  }

  return (
    <CitizenShell active="/services">
      <PageHeader
        eyebrow="eGovPH · eLGU services"
        title="Request a local government document online"
        description="Use your verified eGovPH identity, submit supporting evidence, pay the assessed fee, and receive a QR-verifiable PDF without returning to the hall."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['Certificates', 'Permits', 'Social assistance', 'Business'].map((category) => (
          <div key={category} className="rounded-sm border border-border bg-brand-soft p-3 text-center text-sm font-bold text-brand">
            {category}
          </div>
        ))}
      </div>

      {dbError ? <SetupNotice error={dbError} /> : null}
      {!dbError && services.length === 0 ? (
        <Card><EmptyState title="No published services yet" description="An LGU officer can publish the first bounded service from the AI Studio." /></Card>
      ) : null}

      {[...byLgu.entries()].map(([lguId, lguServices]) => {
        const lgu = lguServices[0].lgu
        return (
          <Card key={lguId}>
            <CardHeader
              title={lgu.name}
              description={`${lguServices.length} published service${lguServices.length === 1 ? '' : 's'} · rendered natively inside eGovPH`}
              action={<Badge tone="success">Live</Badge>}
            />
            <ul className="divide-y divide-border">
              {lguServices.map((service) => (
                <li key={service.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{service.template.name}</p>
                    <p className="mt-0.5 text-sm text-muted">{service.template.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={service.fee_amount > 0 ? 'accent' : 'success'}>
                        {service.fee_amount > 0 ? peso(service.fee_amount) : 'No fee'}
                      </Badge>
                      {service.waivers.map((waiver) => <Badge key={waiver.category} tone="neutral">Waived: {waiver.label}</Badge>)}
                    </div>
                  </div>
                  <ButtonLink href={`/apply/${service.id}`}>Request this</ButtonLink>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}

      <Card>
        <CardHeader title="Received a document from an LGU?" description="Scan the QR printed on the PDF, or check its authenticity here." />
        <CardBody><Link href="/verify" className="text-sm font-medium text-brand hover:underline">Verify a document →</Link></CardBody>
      </Card>
    </CitizenShell>
  )
}

function SetupNotice({ error }: { error: string }) {
  return (
    <Card className="border-warn/30 bg-warn-soft">
      <CardHeader title="Service directory is temporarily unavailable" />
      <CardBody className="space-y-2 text-sm text-warn">
        <p>The service catalog could not be loaded. Please try again shortly.</p>
        {process.env.NODE_ENV === 'development' ? <p className="font-mono text-xs opacity-80">{error}</p> : null}
      </CardBody>
    </Card>
  )
}
