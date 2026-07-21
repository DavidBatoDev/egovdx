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
import { listPublishedServices, type PublishedService } from '@/lib/data'
import { peso } from '@/lib/format'
import { CitizenShell } from '@/components/shell/citizen-shell'

export default async function HomePage() {
  let services: PublishedService[] = []
  let dbError: string | null = null

  // A missing or wrong Supabase config is the most likely first-run failure, so
  // it gets a specific, actionable panel instead of a 500 page.
  try {
    services = await listPublishedServices()
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
  }

  const byLgu = new Map<string, PublishedService[]>()
  for (const service of services) {
    const existing = byLgu.get(service.lgu.id)
    if (existing) existing.push(service)
    else byLgu.set(service.lgu.id, [service])
  }

  return (
    <CitizenShell active="/">
      <PageHeader
        eyebrow="eGovPH · eLGU services"
        title="Request a barangay document online"
        description="Your identity and address are pulled from your verified eGovPH record — you don't retype what the government already knows. Approved documents are issued as PDFs carrying a QR code anyone can verify."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['Certificates', 'Permits', 'Social assistance', 'Business'].map((category) => <div key={category} className="rounded-sm border border-border bg-brand-soft p-3 text-center text-sm font-bold text-brand">{category}</div>)}</div>

      {dbError ? <SetupNotice error={dbError} /> : null}

      {!dbError && services.length === 0 ? (
        <Card>
          <EmptyState
            title="No published services yet"
            description="Run supabase/seed.sql in the Supabase SQL editor to load the demo barangays and services."
          />
        </Card>
      ) : null}

      {[...byLgu.entries()].map(([lguId, lguServices]) => {
        const lgu = lguServices[0].lgu
        return (
          <Card key={lguId}>
            <CardHeader
              title={lgu.name}
              description={`${lguServices.length} published service${lguServices.length === 1 ? '' : 's'} · rendered natively inside eGovPH, not an external redirect`}
              action={<Badge tone="success">Live</Badge>}
            />
            <ul className="divide-y divide-border">
              {lguServices.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{service.template.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {service.template.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={service.fee_amount > 0 ? 'accent' : 'success'}>
                        {service.fee_amount > 0 ? peso(service.fee_amount) : 'No fee'}
                      </Badge>
                      {service.waivers.map((waiver) => (
                        <Badge key={waiver.category} tone="neutral">
                          Waived: {waiver.label}
                        </Badge>
                      ))}
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
        <CardHeader
          title="Received a document from a barangay?"
          description="Scan the QR printed on the PDF, or check its authenticity here."
        />
        <CardBody>
          <Link href="/verify" className="text-sm font-medium text-brand hover:underline">
            Verify a document →
          </Link>
        </CardBody>
      </Card>
    </CitizenShell>
  )
}

function SetupNotice({ error }: { error: string }) {
  return (
    <Card className="border-warn/30 bg-warn-soft">
      <CardHeader title="Finish the Supabase setup to load services" />
      <CardBody className="space-y-3 text-sm text-warn">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Copy <code className="font-mono">.env.local.template</code> to{' '}
            <code className="font-mono">.env.local</code> and fill in the three Supabase
            values from Project Settings → API.
          </li>
          <li>
            Run <code className="font-mono">supabase/schema.sql</code>, then{' '}
            <code className="font-mono">supabase/seed.sql</code>, in the Supabase SQL
            editor.
          </li>
          <li>Restart the dev server so the new env vars are picked up.</li>
        </ol>
        <p className="font-mono text-xs opacity-80">{error}</p>
      </CardBody>
    </Card>
  )
}
