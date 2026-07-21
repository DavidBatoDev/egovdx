import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { listRequestsForLgu } from '@/lib/data'
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui'
import { peso } from '@/lib/format'

export const dynamic = 'force-dynamic'

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a,b) => a-b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/console/analytics')
  if (session.role !== 'officer' || !session.lguId) redirect('/console')
  const requests = await listRequestsForLgu(session.lguId)
  const issued = requests.filter((r) => r.status === 'issued')
  const durations = issued.filter((r) => r.issued_at).map((r) => new Date(r.issued_at!).getTime() - new Date(r.created_at).getTime())
  const medianMs = median(durations)
  const paid = requests.filter((r) => r.fee_status === 'paid').reduce((sum, r) => sum + Number(r.fee_due), 0)
  const waived = requests.filter((r) => r.fee_status === 'waived').length
  return <div className="space-y-6"><PageHeader eyebrow="Officer console" title="Service analytics" description="LGU-scoped operational outcomes" />{requests.length === 0 ? <Card><EmptyState title="No request data yet" description="Metrics will appear after citizens submit services." /></Card> : <div className="grid gap-4 md:grid-cols-4"><Metric title="Requests" value={String(requests.length)} /><Metric title="Completion rate" value={`${Math.round(issued.length / requests.length * 100)}%`} /><Metric title="Median issue time" value={medianMs == null ? '—' : `${Math.round(medianMs / 60000)} min`} /><Metric title="Fees" value={`${peso(paid)} · ${waived} waived`} /></div>}</div>
}

function Metric({ title, value }: { title: string; value: string }) { return <Card><CardHeader title={title} /><CardBody><p className="text-2xl font-semibold">{value}</p></CardBody></Card> }

