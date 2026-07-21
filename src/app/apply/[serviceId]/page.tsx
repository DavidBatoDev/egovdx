import { notFound, redirect } from 'next/navigation'
import { CitizenApplyFlow, type ApplyService } from '@/components/citizen/CitizenApplyFlow'
import { getSession } from '@/lib/auth/session'
import { getService } from '@/lib/data'
import { egovMode } from '@/lib/egov/client'

export const metadata = { title: 'Request a service — eGovDX Local' }

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  const session = await getSession()
  if (!session) redirect(`/signin?next=${encodeURIComponent(`/apply/${serviceId}`)}`)
  if (session.role !== 'citizen') redirect('/')

  const service = await getService(serviceId)
  if (!service || service.status !== 'published') notFound()

  const applyService: ApplyService = {
    id: service.id,
    lguName: service.lgu.name,
    templateName: service.template.name,
    description: service.template.description,
    feeAmount: service.fee_amount,
    requiredDocs: service.required_docs,
    formFields: service.form_fields,
    approvalOffice: service.approval_office,
    livenessMode: egovMode('LIVENESS'),
  }

  return <CitizenApplyFlow service={applyService} />
}
