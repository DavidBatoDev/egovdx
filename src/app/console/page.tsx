import { redirect } from 'next/navigation'
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { getSession } from '@/lib/auth/session'
import { listRequestsForLgu, listServicesForLgu } from '@/lib/data'
import { peso } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/server'
import { RequestQueue } from './requests/request-queue'
import StudioClient from './studio/studio-client'

export const dynamic = 'force-dynamic'

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function Metric({ label, value, detail, tone = 'brand' }: { label: string; value: string; detail: string; tone?: 'brand' | 'accent' | 'warn' }) {
  return <Card className="overflow-hidden"><CardBody className="space-y-2 border-l-4 border-brand py-4"><Badge tone={tone}>{label}</Badge><p className="font-display text-3xl text-foreground">{value}</p><p className="text-sm text-muted">{detail}</p></CardBody></Card>
}

export default async function OfficerConsole() {
  const session = await getSession()
  if (!session) redirect('/signin?next=/console')
  if (session.role !== 'officer') redirect('/')
  if (!session.lguId) redirect('/console/register')

  const db = supabaseAdmin()
  const [{ data: lgu }, { data: officer }] = await Promise.all([
    db.from('lgus').select('id, name, type').eq('id', session.lguId).maybeSingle(),
    db.from('officers').select('office').eq('egov_sub', session.sub).eq('role', 'officer').maybeSingle(),
  ])
  if (!lgu) redirect('/console/register')

  const [services, allRequests] = await Promise.all([listServicesForLgu(lgu.id), listRequestsForLgu(lgu.id)])
  const workspaceName = lgu.type === 'barangay'
    ? `Barangay ${lgu.name}`
    : lgu.type === 'city'
      ? `${lgu.name.replace(/^City of\s+/i, '').replace(/\s+City$/i, '')} City`
      : lgu.name
  const requests = officer?.office
    ? allRequests.filter((request) => (request.service.approval_office ?? '').toLowerCase() === officer.office!.toLowerCase())
    : allRequests
  const active = services.filter((service) => service.status === 'published')
  const flagged = services.filter((service) => service.status === 'flagged')
  const waiting = requests.filter((request) => request.status === 'submitted')
  const issued = requests.filter((request) => request.status === 'issued')
  const paid = requests.filter((request) => request.fee_status === 'paid').reduce((sum, request) => sum + Number(request.fee_due), 0)
  const issueDurations = issued
    .filter((request) => request.issued_at)
    .map((request) => new Date(request.issued_at!).getTime() - new Date(request.created_at).getTime())
  const medianIssueTime = median(issueDurations)

  return (
    <div className="space-y-8 pb-8">
      <section className="overflow-hidden rounded-md bg-brand text-white">
        <div className="grid gap-6 px-5 py-7 md:grid-cols-[1fr_auto] md:px-8 md:py-9">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/75"><span className="font-bold uppercase tracking-wider">LGU Workspace</span><span>•</span><span className="font-semibold text-white">{workspaceName}</span>{officer?.office ? <><span>•</span><span>{officer.office}</span></> : null}</div>
            <h1 className="font-display text-3xl leading-tight md:text-4xl">Good day, {session.name.split(' ')[0]}.</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/80">Manage every part of your local digital service—from AI-assisted creation to approval and measurable citizen outcomes—in one secure workspace.</p>
          </div>
          <div className="flex items-start"><ButtonLink href="#studio" className="bg-white !text-brand hover:bg-brand-soft">Create eService with AI</ButtonLink></div>
        </div>
        <nav aria-label="LGU workspace sections" className="flex gap-1 overflow-x-auto border-t border-white/20 px-3 py-2 text-sm whitespace-nowrap md:px-6">
          {[['#overview', 'Overview'], ['#studio', 'AI eService Studio'], ['#approvals', `Approval queue${waiting.length ? ` (${waiting.length})` : ''}`], ['#analytics', 'Analytics']].map(([href, label]) => <a key={href} href={href} className="rounded-sm px-3 py-2 font-bold text-white/80 hover:bg-white/10 hover:text-white">{label}</a>)}
        </nav>
      </section>

      <section id="overview" className="scroll-mt-6 space-y-4">
        <PageHeader eyebrow="Command centre" title={lgu.name} description="Your services, incoming applications, and delivery performance at a glance." action={<Badge tone={flagged.length ? 'warn' : 'success'}>{flagged.length ? `${flagged.length} service${flagged.length === 1 ? '' : 's'} need DICT review` : 'All services in good standing'}</Badge>} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Live eServices" value={String(active.length)} detail={`${services.length} configured in total`} />
          <Metric label="Awaiting decision" value={String(waiting.length)} detail={officer?.office ? `Routed to ${officer.office}` : 'Across all LGU offices'} tone={waiting.length ? 'warn' : 'brand'} />
          <Metric label="Issued documents" value={String(issued.length)} detail={requests.length ? `${Math.round((issued.length / requests.length) * 100)}% completion rate` : 'Ready for your first citizen request'} />
          <Metric label="Fees collected" value={peso(paid)} detail={`${requests.filter((request) => request.fee_status === 'waived').length} request(s) waived`} tone="accent" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader title="Your eServices" description="Every published service is immediately available in the eGovPH citizen catalog." action={<ButtonLink href="#studio" variant="ghost">Add service</ButtonLink>} />
          <CardBody className="p-0">
            {services.length ? <ul className="divide-y divide-border">{services.map((service) => <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div><p className="font-semibold">{service.template.name}</p><p className="mt-0.5 text-sm text-muted">{service.approval_office ?? 'LGU approval office'} · {service.required_docs.length} required document{service.required_docs.length === 1 ? '' : 's'}</p></div><div className="flex items-center gap-2"><StatusBadge status={service.status} />{service.status === 'published' ? <ButtonLink href={`/citizen/lgus/${lgu.id}`} variant="ghost">Citizen view</ButtonLink> : null}</div></li>)}</ul> : <div className="py-4"><EmptyState title="Your LGU is ready for its first eService" description="Upload a local template and describe the service once—the AI handles the structured setup." /></div>}
          </CardBody>
        </Card>
        <Card className="bg-brand-soft">
          <CardHeader title="How this workspace works" description="A fixed DICT-approved flow keeps every service safe and consistent." />
          <CardBody><ol className="space-y-4 text-sm"><li className="flex gap-3"><span className="font-display text-2xl text-brand">01</span><span><strong>Describe the service</strong><br /><span className="text-muted">AI prepares the form, fee and routing within approved bounds.</span></span></li><li className="flex gap-3"><span className="font-display text-2xl text-brand">02</span><span><strong>Publish with oversight</strong><br /><span className="text-muted">Conforming services go live; exceptions go to DICT review.</span></span></li><li className="flex gap-3"><span className="font-display text-2xl text-brand">03</span><span><strong>Approve without retyping</strong><br /><span className="text-muted">Verified citizen data and evidence are already attached to each request.</span></span></li></ol></CardBody>
        </Card>
      </section>

      <section id="studio" className="scroll-mt-6 space-y-4 border-t border-border pt-8">
        <PageHeader eyebrow="Create" title="AI eService Studio" description="Turn your local permit or certificate into an eGovPH-native service without configuring a workflow by hand." />
        <StudioClient />
      </section>

      <section id="approvals" className="scroll-mt-6 space-y-4 border-t border-border pt-8">
        <PageHeader eyebrow="Operate" title="Approval queue" description={officer?.office ? `Only requests routed to ${officer.office} are shown.` : 'Review incoming paid or waived requests from every LGU office.'} />
        <Card><CardHeader title="Incoming citizen requests" description={`${requests.length} request${requests.length === 1 ? '' : 's'} in this workspace`} /><CardBody className="p-0">{requests.length ? <RequestQueue initialRequests={requests} /> : <EmptyState title="No requests waiting" description="Paid or waived citizen requests will appear here for approval." />}</CardBody></Card>
      </section>

      <section id="analytics" className="scroll-mt-6 space-y-4 border-t border-border pt-8">
        <PageHeader eyebrow="Measure" title="Service analytics" description="Operational outcomes for this LGU, updated as citizens use your published services." />
        <div className="grid gap-4 md:grid-cols-3"><Metric label="Completion rate" value={requests.length ? `${Math.round((issued.length / requests.length) * 100)}%` : '—'} detail="Applications issued as official documents" /><Metric label="Median issue time" value={medianIssueTime == null ? '—' : `${Math.round(medianIssueTime / 60000)} min`} detail="From citizen submission to issuance" /><Metric label="Review flag rate" value={services.length ? `${Math.round((flagged.length / services.length) * 100)}%` : '—'} detail="Services requiring DICT review" tone={flagged.length ? 'warn' : 'brand'} /></div>
      </section>
    </div>
  )
}
