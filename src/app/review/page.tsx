import { redirect } from 'next/navigation'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, StatusBadge, inputClass } from '@/components/ui'
import { requireRole } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import { publishService, rejectService, resolveFlag } from './actions'

type ReviewFlag = { id: string; severity: 'info' | 'warn' | 'block'; resolved: boolean; rule_code: string; message: string; resolution_note: string | null }
type ReviewService = Record<string, unknown> & { id: string; status: string; source_prompt: string | null; fee_amount: number; waivers: unknown; eligibility: unknown; form_fields: unknown; approval_office: string | null; generation_confidence: number | null; lgu: { name: string }; template: { name: string }; flags: ReviewFlag[] }

export default async function ReviewPage() {
  await requireRole('reviewer').catch(() => redirect('/signin?next=/review'))
  const { data, error } = await supabaseAdmin().from('lgu_services')
    .select('*,lgu:lgus(name),template:service_templates(code,name),flags:validation_flags(*)')
    .eq('status', 'flagged').order('submitted_at', { ascending: true })
  if (error) throw error
  const services = (data ?? []) as unknown as ReviewService[]
  return <div className="space-y-6"><PageHeader eyebrow="DICT reviewer" title="Validation review queue" description="Approve exceptions with an audit note, reject unsafe configurations, and publish only after every blocking finding is resolved." />
    {!services.length ? <Card><EmptyState title="No flagged services" description="Template-conforming services publish without entering this queue." /></Card> : services.map((service) => {
      const unresolvedBlocks = service.flags.filter((flag) => flag.severity === 'block' && !flag.resolved).length
      return <Card key={service.id}><CardHeader title={`${service.template.name} · ${service.lgu.name}`} description={service.source_prompt || 'Generated from an uploaded form'} action={<StatusBadge status={service.status} />} />
        <CardBody className="space-y-5"><div className="grid gap-4 lg:grid-cols-2"><section><h3 className="mb-2 text-sm font-semibold">Generated schema</h3><pre className="max-h-72 overflow-auto rounded-lg bg-background p-3 text-xs">{JSON.stringify({ feeAmount: service.fee_amount, waivers: service.waivers, eligibility: service.eligibility, formFields: service.form_fields, approvalOffice: service.approval_office, confidence: service.generation_confidence }, null, 2)}</pre></section>
          <section><h3 className="mb-2 text-sm font-semibold">Findings</h3><div className="space-y-3">{service.flags.map((flag) => <div key={flag.id} className="rounded-lg border border-border p-3"><div className="flex gap-2"><Badge tone={flag.severity === 'block' ? 'danger' : 'warn'}>{flag.severity}</Badge><code className="text-xs">{flag.rule_code}</code>{flag.resolved ? <Badge tone="success">Resolved</Badge> : null}</div><p className="mt-2 text-sm">{flag.message}</p>{!flag.resolved ? <form action={resolveFlag} className="mt-3 flex gap-2"><input type="hidden" name="flagId" value={flag.id} /><input className={inputClass} name="note" required placeholder="Required approved-exception note" /><Button variant="secondary">Resolve</Button></form> : <p className="mt-2 text-xs text-muted">{flag.resolution_note}</p>}</div>)}</div></section></div>
          <div className="flex flex-wrap gap-3 border-t border-border pt-4"><form action={publishService}><input type="hidden" name="serviceId" value={service.id} /><Button disabled={unresolvedBlocks > 0}>Publish service</Button></form><form action={rejectService} className="flex gap-2"><input type="hidden" name="serviceId" value={service.id} /><input className={inputClass} name="note" required placeholder="Required rejection note" /><Button variant="danger">Reject</Button></form>{unresolvedBlocks ? <p className="self-center text-sm text-danger">{unresolvedBlocks} blocking finding(s) remain.</p> : null}</div>
        </CardBody></Card>
    })}
  </div>
}
