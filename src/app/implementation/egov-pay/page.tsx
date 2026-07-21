import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export default function EgovPayHarness() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Integration harness" title="eGOV PAY" description="Creates and reconciles a payment transaction through the normalized server adapter." />
      <Card>
        <CardHeader title="Frozen contract" description="Payment calls are server-only and preserve live/mock/fallback source information." />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs text-muted">{`generatePayment(amount, description, txnid)\ncheckPayment(uuid)\nvoidPayment(uuid)`}</pre>
          <p className="mt-4 text-sm text-muted">The citizen flow calls this adapter when a service has a non-waived fee. The payment callback reconciles the gateway status before setting a request to paid.</p>
        </CardBody>
      </Card>
    </div>
  )
}
