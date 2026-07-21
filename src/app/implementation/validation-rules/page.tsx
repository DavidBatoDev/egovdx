import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { getFeature } from '../manifest'

const rules = [
  ['FEE_ABOVE_TEMPLATE_CEILING', 'block'], ['UNKNOWN_WAIVER_CATEGORY', 'block'], ['ELIGIBILITY_KEY_NOT_ALLOWED', 'block'], ['TOO_MANY_CUSTOM_FIELDS', 'warn'], ['ELIGIBILITY_ABOVE_TYPICAL', 'warn'], ['LOW_GENERATION_CONFIDENCE', 'warn'],
]
export default function ValidationHarness() {
  const feature = getFeature('validation-rules')!
  return <div className="space-y-6"><PageHeader eyebrow={`Owner: ${feature.owner}`} title={feature.name} description={feature.summary} action={<Badge tone="accent">Contract frozen</Badge>} /><Card><CardHeader title="Trigger and raw rule set" description="Generation in the AI Studio invokes this validator before any service is saved." /><CardBody><pre className="rounded-lg bg-background p-4 text-xs">{JSON.stringify(rules.map(([ruleCode, severity]) => ({ ruleCode, severity })), null, 2)}</pre></CardBody></Card><Card><CardHeader title="Exported contract" /><CardBody><code className="text-xs">validateService(service, template) → ServiceValidationFlag[]</code></CardBody></Card></div>
}
