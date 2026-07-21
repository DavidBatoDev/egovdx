import { Card, CardBody, CardHeader } from '@/components/ui'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { listPublishedServices, type PublishedService } from '@/lib/data'
import { supabaseAdmin } from '@/lib/supabase/server'
import { ServicesClient, type CitizenLgu } from './services-client'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  let services: PublishedService[] = []
  let lguRows: { id: string; name: string; type: string }[] = []
  let dbError: string | null = null

  try {
    const [publishedServices, { data: registeredLgus, error }] = await Promise.all([
      listPublishedServices(),
      supabaseAdmin().from('lgus').select('id, name, type').order('name'),
    ])
    if (error) throw error
    services = publishedServices
    lguRows = registeredLgus ?? []
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error)
  }

  const groups = new Map<string, CitizenLgu>(lguRows.map((lgu) => [lgu.id, { ...lgu, services: [] }]))
  for (const service of services) {
    const current = groups.get(service.lgu.id) ?? {
      id: service.lgu.id,
      name: service.lgu.name,
      type: service.lgu.type,
      services: [],
    }
    current.services.push({
      id: service.id,
      fee_amount: Number(service.fee_amount),
      waivers: service.waivers,
      required_docs: service.required_docs,
      template: service.template,
    })
    groups.set(service.lgu.id, current)
  }

  return (
    <CitizenShell active="/citizen/services" immersive>
      {dbError ? <Card className="border-warn/30 bg-warn-soft"><CardHeader title="Service directory is temporarily unavailable" /><CardBody><p className="text-sm text-warn">Please try again shortly.</p>{process.env.NODE_ENV === 'development' ? <p className="mt-2 font-mono text-xs text-warn">{dbError}</p> : null}</CardBody></Card> : <ServicesClient lgus={[...groups.values()]} />}
    </CitizenShell>
  )
}
