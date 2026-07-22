import { notFound } from 'next/navigation'
import { LguSiteRenderer } from '@/components/lgu-site/site-renderer'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { listPublishedServices } from '@/lib/data'
import { getPublishedLguSite } from '@/lib/lgu-site/data'
import { DEFAULT_LGU_SITE_CONFIG } from '@/lib/lgu-site/schema'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LguServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [allServices, site, { data: registeredLgu }] = await Promise.all([
    listPublishedServices(),
    getPublishedLguSite(id),
    supabaseAdmin().from('lgus').select('id,name,type').eq('id', id).maybeSingle(),
  ])
  const services = allServices.filter((service) => service.lgu.id === id)
  const lgu = site?.lgu ?? services[0]?.lgu ?? registeredLgu
  if (!lgu) notFound()
  return <CitizenShell active="/citizen/lgus" wide><LguSiteRenderer lgu={lgu} config={site?.config ?? DEFAULT_LGU_SITE_CONFIG} services={services} /></CitizenShell>
}
