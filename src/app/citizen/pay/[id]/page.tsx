import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getRequest } from '@/lib/data'
import { PaymentClient } from './payment-client'

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/signin?next=/citizen/pay/${id}`)
  if (session.role !== 'citizen') redirect('/')
  const request = await getRequest(id)
  if (!request || request.citizen_sub !== session.sub) redirect('/')
  return <PaymentClient requestId={id} serviceName={request.service.template.name} fee={Number(request.service.fee_amount)} waivers={request.service.waivers} initialStatus={request.fee_status} />
}
