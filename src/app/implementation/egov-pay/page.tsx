import { Card, CardBody, CardHeader, PageHeader, SourceBadge } from '@/components/ui'
import { egovMode } from '@/lib/egov/client'
import { checkPayment, generatePayment } from '@/lib/egov/pay'

export default async function EgovPayHarness() {
  const mode = egovMode('PAY')
  const created = mode === 'mock' ? await generatePayment(150, 'Harness sanitation permit', 'harness-payment') : null
  const checked = created ? await checkPayment(created.data.uuid) : null
  return <div className="space-y-6"><PageHeader eyebrow="Integration harness" title="eGOV PAY" description="Normalized generation and authoritative status reconciliation." /><Card><CardHeader title="Result" action={created ? <SourceBadge source={created.source} /> : undefined} /><CardBody>{created ? <pre className="overflow-auto rounded-lg bg-background p-4 text-xs">{JSON.stringify({ trigger: { amount: 150, txnid: 'harness-payment' }, created: created.data, checked: checked?.data, source: created.source }, null, 2)}</pre> : <p className="text-sm text-muted">Live mode is armed. Use the controlled payment journey instead of creating a transaction on page load.</p>}</CardBody></Card><Card><CardHeader title="Frozen contract" /><CardBody><pre className="rounded-lg bg-background p-4 text-xs">{`generatePayment(amount, description, txnid)\ncheckPayment(uuid)\nvoidPayment(uuid)`}</pre></CardBody></Card></div>
}
