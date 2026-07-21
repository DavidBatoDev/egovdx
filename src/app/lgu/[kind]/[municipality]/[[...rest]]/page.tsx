import { notFound, redirect } from 'next/navigation'
import OfficerDashboard from '@/components/officer/dashboard'
import { OfficerAnalytics, OfficerRequests, OfficerStudio } from '@/components/officer/section-pages'
import { getSession } from '@/lib/auth/session'
import { getOfficerLguScope } from '@/lib/lgu-scope'

export const dynamic = 'force-dynamic'

type OfficerSection = 'studio' | 'requests' | 'analytics'

function parseRest(rest: string[] | undefined): { barangaySlug: string | null; section: OfficerSection | null } | null {
  if (!rest?.length) return { barangaySlug: null, section: null }
  if (rest.length === 1 && ['studio', 'requests', 'analytics'].includes(rest[0])) {
    return { barangaySlug: null, section: rest[0] as OfficerSection }
  }
  if (rest.length === 2 && rest[0] === 'brgy') {
    return { barangaySlug: rest[1], section: null }
  }
  if (rest.length === 3 && rest[0] === 'brgy' && ['studio', 'requests', 'analytics'].includes(rest[2])) {
    return { barangaySlug: rest[1], section: rest[2] as OfficerSection }
  }
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
    redirect(`${scope.canonicalBase}${parsed.section ? `/${parsed.section}` : ''}`)
  }

  if (parsed.section === 'studio') return <OfficerStudio dashboardHref={scope.canonicalBase} />
  if (parsed.section === 'requests') return <OfficerRequests session={session} />
  if (parsed.section === 'analytics') return <OfficerAnalytics session={session} />
  return <OfficerDashboard session={session} scope={scope} />
}
