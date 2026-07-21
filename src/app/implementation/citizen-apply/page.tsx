import { PageHeader, Card, CardBody, CardHeader } from '@/components/ui'
import { CitizenApplyHarness } from './preview'

export default function CitizenApplyHarnessPage() {
  return <div className="space-y-6"><PageHeader eyebrow="Jasmin · implementation harness" title="Dynamic citizen application" description="Exercises every supported generated field type without writing a request." /><Card><CardHeader title="Trigger and raw result" /><CardBody><CitizenApplyHarness /></CardBody></Card><Card><CardHeader title="Exported contract" /><CardBody><pre className="text-xs">DynamicForm({`{ fields, prefill, onSubmit }`})</pre><p className="mt-2 text-xs text-muted">Identity source is labelled mock in this isolated harness. The real route uses live eVerify or fails closed.</p></CardBody></Card></div>
}
