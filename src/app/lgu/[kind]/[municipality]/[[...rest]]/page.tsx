import { notFound, redirect } from 'next/navigation'
import OfficerDashboard from '@/components/officer/dashboard'
import { OfficerAiStudio, OfficerAnalytics, OfficerManualStudio, OfficerRequests, OfficerStudioHub, OfficerWebsite } from '@/components/officer/section-pages'
import { getSession } from '@/lib/auth/session'
import { getOfficerLguScope } from '@/lib/lgu-scope'

export const dynamic = 'force-dynamic'

type OfficerSection = 'studio' | 'studio-ai' | 'studio-manual' | 'requests' | 'analytics' | 'website'

function parseRest(rest: string[] | undefined): { barangaySlug: string | null; section: OfficerSection | null; serviceId: string | null } | null {
  let path = rest ?? []
  let barangaySlug: string | null = null
  if (path[0] === 'brgy') {
    if (!path[1]) return null
    barangaySlug = path[1]
    path = path.slice(2)
  }
  if (!path.length) return { barangaySlug, section: null, serviceId: null }
  if (path.length === 1 && ['requests', 'analytics', 'website'].includes(path[0])) return { barangaySlug, section: path[0] as OfficerSection, serviceId: null }
  if (path[0] !== 'studio') return null
  if (path.length === 1) return { barangaySlug, section: 'studio', serviceId: null }
  if (path.length === 2 && path[1] === 'ai') return { barangaySlug, section: 'studio-ai', serviceId: null }
  if (path.length === 2 && path[1] === 'manual') return { barangaySlug, section: 'studio-manual', serviceId: null }
  if (path.length === 3 && path[1] === 'manual') return { barangaySlug, section: 'studio-manual', serviceId: path[2] }
  return null
}

export default async function ScopedOfficerPage({
  params,
}: {
  params: Promise<{ kind: string; municipality: string; rest?: string[] }>
}) {
  const route = await params
  const parsed = parseRest(route.rest)
  if (!parsed || !['municipal', 'city'].includes(route.kind)) notFound()

  const session = await getSession()
  if (!session) redirect('/signin?next=/lgu')
  if (session.role !== 'officer') redirect('/')
  if (!session.lguId) redirect('/lgu/register')

  const scope = await getOfficerLguScope(session.lguId)
  const routeMatchesScope = route.kind === scope.kind
    && route.municipality === scope.municipalitySlug
    && parsed.barangaySlug === scope.barangaySlug
  if (!routeMatchesScope) {
    const suffix = parsed.section === 'studio-ai' ? '/studio/ai' : parsed.section === 'studio-manual' ? `/studio/manual${parsed.serviceId ? `/${parsed.serviceId}` : ''}` : parsed.section ? `/${parsed.section}` : ''
    redirect(`${scope.canonicalBase}${suffix}`)
  }

  if (parsed.section === 'studio') return <OfficerStudioHub dashboardHref={scope.canonicalBase} />
  if (parsed.section === 'studio-ai') return <OfficerAiStudio dashboardHref={scope.canonicalBase} lguId={scope.lguId} />
  if (parsed.section === 'studio-manual') return <OfficerManualStudio dashboardHref={scope.canonicalBase} lguId={scope.lguId} serviceId={parsed.serviceId} />
  if (parsed.section === 'requests') return <OfficerRequests session={session} />
  if (parsed.section === 'analytics') return <OfficerAnalytics session={session} />
  if (parsed.section === 'website') return <OfficerWebsite lguId={scope.lguId} />
  return <OfficerDashboard session={session} scope={scope} />
}
