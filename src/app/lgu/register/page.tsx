import { redirect } from 'next/navigation'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { RegisterLguForm } from '@/components/officer/register-form'
import { getSession } from '@/lib/auth/session'
import { searchPsgc } from '@/lib/psgc'

export const dynamic = 'force-dynamic'

export default async function RegisterLguPage() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/lgu/register')
  if (session.role !== 'officer') redirect('/')
  const initialResults = await searchPsgc('Marilao').catch(() => [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="LGU workspace" title="Register an LGU" description="Search the PSA geographic reference, then add the LGU’s official contact for service onboarding." />
      <Card>
        <CardHeader title="LGU registration" description="This creates a new configuration space. It does not publish any eService." />
        <CardBody><RegisterLguForm initialResults={initialResults} /></CardBody>
      </Card>
    </div>
  )
}
