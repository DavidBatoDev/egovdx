import { Card, CardBody, CardHeader, PageHeader, SourceBadge } from '@/components/ui'
import { egovMode } from '@/lib/egov/client'
import { issuedSmsBody, pushSms } from '@/lib/egov/emessage'

export default async function EmessageHarness() {
  const mode = egovMode('EMESSAGE')
  const message = issuedSmsBody('Barangay Clearance', 'BRGY-2026-000001', 'https://egovdx.vercel.app/verify/demo')
  const result = mode === 'mock' ? await pushSms('+639000000000', message) : null
  return <div className="space-y-6"><PageHeader eyebrow="Integration harness" title="eMessage" description="E.164 normalization and issuance notification delivery." /><Card><CardHeader title="Result" action={result ? <SourceBadge source={result.source} /> : undefined} /><CardBody>{result ? <pre className="overflow-auto rounded-lg bg-background p-4 text-xs">{JSON.stringify({ trigger: { number: '+639••••••000', messageType: 'issued' }, result: result.data, source: result.source }, null, 2)}</pre> : <p className="text-sm text-muted">Live mode is armed. SMS delivery is exercised only through the controlled issuance journey.</p>}</CardBody></Card><Card><CardHeader title="Frozen contract" /><CardBody><pre className="rounded-lg bg-background p-4 text-xs">{`pushSms(mobile, message)\nissuedSmsBody(serviceName, controlNumber, verifyUrl)`}</pre></CardBody></Card></div>
}
