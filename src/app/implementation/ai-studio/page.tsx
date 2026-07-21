import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import StudioClient from '@/app/console/studio/studio-client'
import { getFeature } from '../manifest'

export default function AiStudioHarness() {
  const feature = getFeature('ai-studio')!
  return <div className="space-y-6"><PageHeader eyebrow={`Owner: ${feature.owner}`} title={feature.name} description={feature.summary} action={<Badge tone="accent">Contract frozen</Badge>} /><StudioClient harness /><Card><CardHeader title="Exported contract" /><CardBody><pre className="text-xs">generateService(prompt, lguId) → GenerationResult{`\n`}generateServiceFromExtraction(extraction, lguId) → GenerationResult</pre></CardBody></Card></div>
}
