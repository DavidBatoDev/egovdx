import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getOrCreateDraft } from '@/lib/citizen/applications'
import { egovMode } from '@/lib/egov/client'
import { ApplicationClient } from './application-client'

export const dynamic = 'force-dynamic'

export default async function ApplyPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params
  const session = await getSession()
  if (!session) redirect(`/signin?next=/citizen/apply/${serviceId}`)
  if (session.role !== 'citizen') redirect('/')
  const draft = await getOrCreateDraft(serviceId, session).catch(() => null)
  if (!draft) redirect('/')
  return <ApplicationClient draft={draft} identityMock={egovMode('EVERIFY') === 'mock'} />
}
