import { notFound } from 'next/navigation'
import { CitizenShell } from '@/components/shell/citizen-shell'
import { LguSiteRenderer } from '@/components/lgu-site/site-renderer'
import { listPublishedServices } from '@/lib/data'
import { getPublishedLguSite } from '@/lib/lgu-site/data'
import { DEFAULT_LGU_SITE_CONFIG } from '@/lib/lgu-site/schema'

export const dynamic = 'force-dynamic'

export default async function LguServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [allServices, site] = await Promise.all([listPublishedServices(), getPublishedLguSite(id)])
  const services = allServices.filter((service) => service.lgu.id === id)
  const lgu = site?.lgu ?? services[0]?.lgu
  if (!lgu) notFound()
  return <CitizenShell active="/citizen/lgus" wide><LguSiteRenderer lgu={lgu} config={site?.config ?? DEFAULT_LGU_SITE_CONFIG} services={services} /></CitizenShell>
}
