import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import StudioClient from '@/components/officer/studio-client'
import { getFeature } from '../manifest'

export default function DocExtractHarness() {
  const feature = getFeature('doc-extract')!
  return <div className="space-y-6"><PageHeader eyebrow={`Owner: ${feature.owner}`} title={feature.name} description={feature.summary} action={<Badge tone="accent">Contract frozen</Badge>} /><StudioClient harness /><Card><CardHeader title="Exported contract" /><CardBody><pre className="text-xs">extractDocument(file, filename) → EgovResult&lt;ExtractionResult&gt;{`\n`}parseExtractionHtml(html) → ExtractionResult</pre></CardBody></Card></div>
}
