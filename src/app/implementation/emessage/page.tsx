import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export default function EmessageHarness() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Integration harness" title="eMessage" description="Normalizes Philippine mobile numbers and sends issuance notifications through the server adapter." />
      <Card>
        <CardHeader title="Frozen contract" />
        <CardBody>
          <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs text-muted">{`pushSms(mobile, message)\nissuedSmsBody(serviceName, controlNumber, verifyUrl)`}</pre>
          <p className="mt-4 text-sm text-muted">The adapter sends E.164 <code>number</code> values with the required <code>X-EMESSAGE-Auth</code> header. Its source result is retained in the request audit trail at issuance.</p>
        </CardBody>
      </Card>
    </div>
  )
}
