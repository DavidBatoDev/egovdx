import { Badge, Card, CardBody, PageHeader } from '@/components/ui'
import { FaceLivenessHarness } from '@/components/liveness/FaceLivenessHarness'
import { egovMode } from '@/lib/egov/client'
import { getFeature } from '../manifest'

export const metadata = { title: 'Face liveness — implementation harness' }

export default function FaceLivenessPage() {
  const feature = getFeature('face-liveness')!

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Owner: ${feature.owner}`}
        title={feature.name}
        description={feature.summary}
        action={<Badge tone="accent">Contract frozen</Badge>}
      />

      <FaceLivenessHarness mode={egovMode('LIVENESS')} />

      <Card>
        <CardBody className="space-y-2 text-sm text-muted">
          <p className="font-medium text-foreground">What this feature provides</p>
          <code className="block font-mono text-xs">
            &lt;LivenessCapture onComplete=&#123;(capture) =&gt; ...&#125; /&gt;
          </code>
          <p>
            eVerify receives <code className="font-mono">capture.sessionId</code> as{' '}
            <code className="font-mono">face_liveness_session_id</code>. The documented SDK has
            no confidence score, so <code className="font-mono">capture.livenessScore</code> is
            intentionally null.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
