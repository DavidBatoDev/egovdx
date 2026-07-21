import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { egovMode } from '@/lib/egov/client'
import { listPublishedServices } from '@/lib/data'
import { EverifyHarness } from './everify-harness'
import { getFeature } from '../manifest'

export const metadata = { title: 'eVerify — implementation harness' }

export default async function EverifyPage() {
  const feature = getFeature('everify')!
  const serviceId = (await listPublishedServices())[0]?.id ?? ''
  return <div className="space-y-6">
    <PageHeader eyebrow={`Owner: ${feature.owner}`} title={feature.name} description={feature.summary} action={<Badge tone="accent">Unified</Badge>} />
    <EverifyHarness mode={egovMode('EVERIFY')} initialServiceId={serviceId} />
    <Card><CardHeader title="Exported contract" /><CardBody><pre className="overflow-auto text-xs">verifyIdentity(query + SDK session_id) → EgovResult&lt;VerifiedIdentity&gt;{`\n`}POST /api/everify/verify → signed verification receipt</pre></CardBody></Card>
  </div>
}
