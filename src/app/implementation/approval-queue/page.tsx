import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'

export default function ApprovalQueueHarness() {
  return <div className="space-y-6"><PageHeader eyebrow="Integration harness" title="Approval and issuance orchestration" description="The officer decision claims one resumable issuance attempt." /><Card><CardHeader title="Exported contract" /><CardBody><pre className="overflow-auto rounded-lg bg-background p-4 text-xs">{`approveAndIssue(requestId, officerSub)\nretryIssuedNotification(requestId, officerSub, note)`}</pre><ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted"><li>Authorize LGU and approval office</li><li>Claim request and allocate control number atomically</li><li>Generate immutable PDF and anchor its hash</li><li>Issue document and send one SMS</li><li>Resume safely from any failed step</li></ol></CardBody></Card></div>
}

