import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getRequest, listEvents } from '@/lib/data'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { TrackClient } from './track-client'

export const dynamic = 'force-dynamic'

export default async function TrackPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const session = await getSession(); if (!session) redirect(`/signin?next=/citizen/track/${requestId}`); if (session.role !== 'citizen') redirect('/')
  const request = await getRequest(requestId); if (!request || request.citizen_sub !== session.sub || request.status === 'draft') redirect('/citizen/requests')
  return <CitizenShell active="/citizen/requests"><TrackClient request={request} events={await listEvents(requestId)} /></CitizenShell>
}
