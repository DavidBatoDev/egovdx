import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { searchPsgc } from '@/lib/psgc'

export default async function LguOnboardingHarness() {
  const entries = await searchPsgc('Marilao').catch(() => [])
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Integration harness" title="LGU onboarding" description="PSA geographic-reference lookup used by officer registration." />
      <Card>
        <CardHeader title="Search result" description="Query: Marilao" />
        <CardBody><pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs text-muted">{JSON.stringify(entries, null, 2)}</pre></CardBody>
      </Card>
    </div>
  )
}
