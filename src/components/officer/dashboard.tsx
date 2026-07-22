import type { ReactNode } from 'react'
import { Badge, ButtonLink, StatusBadge } from '@/components/ui'
import type { Session } from '@/lib/auth/session'
import { listRequestsForLgu, listServicesForLgu } from '@/lib/data'
import { peso } from '@/lib/format'
import type { OfficerLguScope } from '@/lib/lgu-scope'
import { supabaseAdmin } from '@/lib/supabase/server'
import { RequestQueue } from './request-queue'

export const dynamic = 'force-dynamic'

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

type MetricTone = 'brand' | 'accent' | 'warn'

const metricTone: Record<MetricTone, string> = {
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
}

function Metric({
  label,
  value,
  detail,
  tone = 'brand',
  icon,
}: {
  label: string
  value: string
  detail: string
  tone?: MetricTone
  icon: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${metricTone[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{detail}</p>
    </article>
  )
}

function QuickAction({
  href,
  eyebrow,
  title,
  description,
  icon,
  primary = false,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  icon: ReactNode
  primary?: boolean
}) {
  return (
    <a
      href={href}
      className={`group flex min-h-36 items-start gap-4 rounded-2xl border p-5 transition-colors ${primary ? 'border-brand bg-brand text-white hover:bg-brand-hover' : 'border-border bg-surface hover:border-brand hover:bg-brand-soft/35'}`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${primary ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${primary ? 'text-accent-soft' : 'text-brand'}`}>{eyebrow}</span>
        <span className="mt-1 flex items-center gap-2 font-display text-xl">
          {title}
          <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
        <span className={`mt-2 block text-xs leading-5 ${primary ? 'text-white/75' : 'text-muted'}`}>{description}</span>
      </span>
    </a>
  )
}

export default async function OfficerDashboard({ session, scope }: { session: Session; scope: OfficerLguScope }) {
  const db = supabaseAdmin()
  const [{ data: lgu }, { data: officer }] = await Promise.all([
    db.from('lgus').select('id, name, type').eq('id', scope.lguId).maybeSingle(),
    db.from('officers').select('office').eq('egov_sub', session.sub).eq('role', 'officer').maybeSingle(),
  ])
  if (!lgu) throw new Error('LGU_NOT_FOUND')

  const [services, allRequests] = await Promise.all([
    listServicesForLgu(lgu.id),
    listRequestsForLgu(lgu.id),
  ])
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
  const paid = requests
    .filter((request) => request.fee_status === 'paid')
    .reduce((sum, request) => sum + Number(request.fee_due), 0)
  const issueDurations = issued
    .filter((request) => request.issued_at)
    .map((request) => new Date(request.issued_at!).getTime() - new Date(request.created_at).getTime())
  const medianIssueTime = median(issueDurations)
  const firstName = session.name.split(' ')[0]

  return (
    <div className="space-y-7 pb-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-brand px-6 py-8 text-white sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[48px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-36 right-52 h-72 w-72 rounded-full border-[46px] border-white/10" />
        <div className="relative grid items-end gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-accent-soft">
              <span>Official LGU workspace</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />
              <span className="text-white">{workspaceName}</span>
              {officer?.office ? <><span aria-hidden className="h-1 w-1 rounded-full bg-white/50" /><span className="normal-case tracking-normal text-white/70">{officer.office}</span></> : null}
            </div>
            <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">Good day, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Bring local services online, respond to citizen requests, and see how your barangay is delivering—all from one secure workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/citizen/lgus/${lgu.id}`} className="h-11 rounded-full border border-white/30 bg-transparent px-5 text-white hover:bg-white/10">View citizen page</ButtonLink>
            <ButtonLink href={`${scope.canonicalBase}/studio`} className="h-11 rounded-full bg-white px-5 !text-brand hover:bg-brand-soft"><PlusIcon /> Create eService</ButtonLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Your workspace</p>
            <h2 id="quick-actions-title" className="mt-1 font-display text-2xl text-foreground">What would you like to do?</h2>
          </div>
          <Badge tone={flagged.length ? 'warn' : 'success'}>{flagged.length ? `${flagged.length} service${flagged.length === 1 ? '' : 's'} need DICT review` : 'All services in good standing'}</Badge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <QuickAction href={`${scope.canonicalBase}/studio`} eyebrow="Build" title="Create an eService" description="Use the guided AI interview or configure an approved template yourself." icon={<ServiceIcon />} primary />
          <QuickAction href={`${scope.canonicalBase}/website`} eyebrow="Present" title="Manage citizen page" description="Shape how residents discover your barangay and its published services." icon={<WebsiteIcon />} />
          <QuickAction href={`${scope.canonicalBase}/requests`} eyebrow="Operate" title={`Review requests${waiting.length ? ` (${waiting.length})` : ''}`} description={officer?.office ? `Handle applications routed to ${officer.office}.` : 'Approve paid or waived applications and issue documents.'} icon={<InboxIcon />} />
        </div>
      </section>

      <section id="overview" className="scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Today at a glance</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Local service activity</h2>
          </div>
          <a href={`${scope.canonicalBase}/analytics`} className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">Open full analytics <ArrowIcon className="h-4 w-4" /></a>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Live eServices" value={String(active.length)} detail={`${services.length} configured in total`} icon={<ServiceIcon />} />
          <Metric label="Awaiting decision" value={String(waiting.length)} detail={officer?.office ? `Routed to ${officer.office}` : 'Across all LGU offices'} tone={waiting.length ? 'warn' : 'brand'} icon={<InboxIcon />} />
          <Metric label="Issued documents" value={String(issued.length)} detail={requests.length ? `${Math.round((issued.length / requests.length) * 100)}% completion rate` : 'Ready for your first citizen request'} icon={<DocumentIcon />} />
          <Metric label="Fees collected" value={peso(paid)} detail={`${requests.filter((request) => request.fee_status === 'waived').length} request(s) waived`} tone="accent" icon={<PesoIcon />} />
        </div>
      </section>

      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-brand-soft/30 px-5 py-5 sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Your catalog</p>
              <h2 className="mt-1 font-display text-2xl text-foreground">Published and draft eServices</h2>
              <p className="mt-1 text-sm text-muted">Published services appear immediately on your citizen page.</p>
            </div>
            <ButtonLink href={`${scope.canonicalBase}/studio`} variant="secondary"><PlusIcon /> Add service</ButtonLink>
          </div>
          {services.length ? (
            <ul className="divide-y divide-border">
              {services.map((service) => (
                <li key={service.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><DocumentIcon /></span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{service.display_name || service.template.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{service.approval_office ?? 'LGU approval office'} · {service.required_docs.length} required document{service.required_docs.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={service.status} />
                    <ButtonLink href={`${scope.canonicalBase}/studio/manual/${service.id}`} variant="ghost">Edit</ButtonLink>
                    {service.status === 'published' ? <ButtonLink href={`/citizen/lgus/${lgu.id}`} variant="ghost">Citizen view</ButtonLink> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 sm:px-6">
              <div className="rounded-2xl border border-dashed border-border-strong bg-brand-soft/25 px-6 py-8 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand"><ServiceIcon /></span>
                <h3 className="mt-4 font-display text-2xl text-foreground">Publish your first citizen service</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Choose an approved template, add your local fee and requirements, then let validation confirm it is ready for residents.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <ButtonLink href={`${scope.canonicalBase}/studio/ai`}>Start with AI</ButtonLink>
                  <ButtonLink href={`${scope.canonicalBase}/studio/manual`} variant="secondary">Build manually</ButtonLink>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface-footer text-white">
          <div className="border-b border-white/15 px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-soft">Safe by design</p>
            <h2 className="mt-1 font-display text-2xl">From local policy to live service</h2>
          </div>
          <ol className="space-y-5 px-5 py-6">
            <FlowStep number="01" title="Configure locally">Set the fee, requirements, eligibility, and approval office.</FlowStep>
            <FlowStep number="02" title="Validate automatically">DICT rules check every configuration before publication.</FlowStep>
            <FlowStep number="03" title="Serve residents">Verified requests arrive ready for an officer decision.</FlowStep>
          </ol>
        </div>
      </section>

      <section id="approvals" className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-brand-soft/30 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Citizen requests</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Approval queue</h2>
            <p className="mt-1 text-sm text-muted">{officer?.office ? `Only applications routed to ${officer.office} are shown.` : 'Paid or waived applications from every LGU office.'}</p>
          </div>
          <ButtonLink href={`${scope.canonicalBase}/requests`} variant="secondary">Open full queue <ArrowIcon className="h-4 w-4" /></ButtonLink>
        </div>
        {requests.length ? (
          <RequestQueue initialRequests={requests} />
        ) : (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand"><InboxIcon /></span>
            <p className="mt-4 font-bold text-foreground">No applications need attention</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted">New paid or waived requests will appear here with verified citizen data and supporting evidence attached.</p>
          </div>
        )}
      </section>

      <section id="analytics" className="scroll-mt-6 rounded-2xl border border-border bg-brand-soft/25 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Public service outcomes</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Delivery performance</h2>
            <p className="mt-1 text-sm text-muted">Measures update as residents use published services.</p>
          </div>
          <ButtonLink href={`${scope.canonicalBase}/analytics`} variant="ghost">View detailed report</ButtonLink>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Metric label="Completion rate" value={requests.length ? `${Math.round((issued.length / requests.length) * 100)}%` : '—'} detail="Applications issued as official documents" icon={<CompletionIcon />} />
          <Metric label="Median issue time" value={medianIssueTime == null ? '—' : `${Math.round(medianIssueTime / 60000)} min`} detail="From citizen submission to issuance" icon={<ClockIcon />} />
          <Metric label="Review flag rate" value={services.length ? `${Math.round((flagged.length / services.length) * 100)}%` : '—'} detail="Services requiring DICT review" tone={flagged.length ? 'warn' : 'brand'} icon={<ShieldIcon />} />
        </div>
      </section>
    </div>
  )
}

function FlowStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-display text-2xl text-accent-soft">{number}</span>
      <span>
        <strong className="text-sm text-white">{title}</strong>
        <span className="mt-1 block text-xs leading-5 text-white/65">{children}</span>
      </span>
    </li>
  )
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} fill-none stroke-current stroke-2`}><path d="m9 18 6-6-6-6" /></svg>
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 5v14M5 12h14" /></svg>
}

function ServiceIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg>
}

function WebsiteIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
}

function InboxIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 4h16v16H4zM4 14h5l2 2h2l2-2h5" /></svg>
}

function DocumentIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg>
}

function PesoIcon() {
  return <span aria-hidden className="font-display text-xl font-bold">₱</span>
}

function CompletionIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>
}

function ClockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
}
