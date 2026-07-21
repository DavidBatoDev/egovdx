'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Badge,
  Button,
  ButtonLink,
  Field,
  Toast,
  inputClass,
} from '@/components/ui'
import type { GeneratedService } from '@/lib/studio/schema'
import type { LguService, ServiceTemplate } from '@/lib/supabase/types'

type EditableService = Pick<
  LguService,
  | 'id'
  | 'display_name'
  | 'template_id'
  | 'fee_amount'
  | 'waivers'
  | 'required_docs'
  | 'eligibility'
  | 'form_fields'
  | 'approval_office'
>

const sections = [
  ['identity', 'Service details'],
  ['fields', 'Citizen form'],
  ['documents', 'Requirements'],
  ['rules', 'Eligibility & waivers'],
  ['template', 'Review & submit'],
] as const

export function ManualServiceClient({
  baseHref,
  lguId,
  templates,
  initial,
}: {
  baseHref: string
  lguId: string
  templates: ServiceTemplate[]
  initial?: EditableService | null
}) {
  const selectedInitial = initial
    ? templates.find((item) => item.id === initial.template_id)
    : templates[0]
  const blank = makeDraft(selectedInitial, initial)
  const storageKey = `egovdx:studio:manual:${lguId}:${initial?.id ?? 'new'}`
  const [service, setService] = useState<GeneratedService>(blank)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<{
    status: 'published' | 'flagged'
    serviceId: string
  } | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return
    try {
      // Restore the browser-only draft after hydration; there is no server snapshot.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setService(JSON.parse(raw))
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(service))
  }, [storageKey, service])

  const readiness = [
    { label: 'DICT template selected', done: Boolean(service.templateCode) },
    { label: 'Service name provided', done: Boolean(service.name.trim()) },
    { label: 'Approving office assigned', done: Boolean(service.approvalOffice) },
    { label: 'Official document uploaded', done: Boolean(file) },
  ]
  const completed = readiness.filter((item) => item.done).length

  function chooseTemplate(code: string) {
    const template = templates.find((item) => item.code === code)
    if (template) setService(makeDraft(template, null))
  }

  async function submit() {
    if (!file) {
      setError('Upload the official PDF or DOCX template.')
      document.querySelector('#template')?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setBusy(true)
    setError('')
    try {
      const data = new FormData()
      data.append('service', JSON.stringify(service))
      data.append('file', file)
      data.append('engine', 'manual')
      data.append('model', 'officer-entry')
      data.append('generatedBy', 'manual')
      if (initial) data.append('supersedesServiceId', initial.id)

      const response = await fetch('/api/studio/confirm', { method: 'POST', body: data })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Service could not be saved')
      setSaved(json)
      localStorage.removeItem(storageKey)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function updateField(
    index: number,
    patch: Partial<GeneratedService['formFields'][number]>,
  ) {
    const next = [...service.formFields]
    next[index] = { ...next[index], ...patch }
    setService({ ...service, formFields: next })
  }

  function updateWaiver(
    index: number,
    patch: Partial<GeneratedService['waivers'][number]>,
  ) {
    const next = [...service.waivers]
    next[index] = { ...next[index], ...patch }
    setService({ ...service, waivers: next })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-brand px-6 py-8 text-white sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[42px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-28 right-44 h-56 w-56 rounded-full border-[36px] border-white/10" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-accent-soft">
            <span>Manual service builder</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />
            <span className="normal-case tracking-normal text-white/70">Draft saves automatically</span>
          </div>
          <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            {initial ? `Revise ${initial.display_name}` : 'Build a citizen-ready eService'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
            Start with a DICT-approved template, tailor the local requirements, then submit one complete configuration for validation.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href={`${baseHref}/studio`} className="h-11 rounded-full bg-white px-5 !text-brand hover:bg-brand-soft">
              <BackIcon /> Creation options
            </ButtonLink>
            <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold">
              {completed} of {readiness.length} essentials ready
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <BuilderSection
            id="identity"
            number="01"
            eyebrow="Start here"
            title={initial ? 'Revision details' : 'Service details'}
            description={initial ? 'The current published service stays live until this revision passes validation.' : 'Choose the approved service family and define what citizens will see.'}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="DICT-approved template" required hint={<Badge tone="brand">Controlled</Badge>}>
                <select className={inputClass} value={service.templateCode} disabled={Boolean(initial)} onChange={(event) => chooseTemplate(event.target.value)}>
                  {templates.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Citizen-facing service name" required>
                <input className={inputClass} value={service.name} onChange={(event) => setService({ ...service, name: event.target.value })} placeholder="e.g. Barangay Clearance" />
              </Field>
              <Field label="Approving office" required>
                <input className={inputClass} value={service.approvalOffice ?? ''} onChange={(event) => setService({ ...service, approvalOffice: event.target.value || null })} placeholder="e.g. Barangay Secretary" />
              </Field>
              <Field label="Service fee" required hint={<span className="text-xs font-normal text-muted">Philippine peso</span>}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-muted">₱</span>
                  <input className={`${inputClass} pl-8`} aria-label="Service fee in Philippine pesos" type="number" min="0" value={service.feeAmount} onChange={(event) => setService({ ...service, feeAmount: Number(event.target.value) })} />
                </div>
              </Field>
            </div>
          </BuilderSection>

          <BuilderSection
            id="fields"
            number="02"
            eyebrow="Citizen experience"
            title="Citizen form"
            description="Only ask for local information. Verified identity details are supplied by eVerify."
            action={<Button type="button" variant="secondary" onClick={() => setService({ ...service, formFields: [...service.formFields, { key: `field_${service.formFields.length + 1}`, label: 'New field', type: 'text', required: true }] })}><PlusIcon /> Add field</Button>}
          >
            <div className="space-y-3">
              {service.formFields.map((field, index) => (
                <div key={`${field.key}-${index}`} className="rounded-xl border border-border bg-brand-soft/25 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted">Field {String(index + 1).padStart(2, '0')}</span>
                      {field.source === 'everify' ? <Badge tone="brand"><ShieldIcon /> eVerify prefill</Badge> : <Badge tone="neutral">LGU field</Badge>}
                    </div>
                    <Button type="button" variant="danger" className="h-8 px-3 text-xs" onClick={() => setService({ ...service, formFields: service.formFields.filter((_, item) => item !== index) })}>Remove</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(10rem,0.7fr)_auto] md:items-end">
                    <Field label="Question or field label">
                      <input aria-label={`Field ${index + 1} label`} className={inputClass} value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                    </Field>
                    <Field label="Answer type">
                      <select aria-label={`Field ${index + 1} type`} className={inputClass} value={field.type} onChange={(event) => updateField(index, { type: event.target.value as typeof field.type })}>
                        <option value="text">Short text</option>
                        <option value="textarea">Long text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Selection</option>
                      </select>
                    </Field>
                    <label className="flex h-[38px] items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm font-bold text-foreground">
                      <input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /> Required
                    </label>
                  </div>
                </div>
              ))}
              {!service.formFields.length ? (
                <EmptyBuilderState title="No additional questions" description="Citizens will only provide their verified eGovPH information unless you add a local field." action="Add the first field" onClick={() => setService({ ...service, formFields: [{ key: 'field_1', label: 'New field', type: 'text', required: true }] })} />
              ) : null}
            </div>
          </BuilderSection>

          <BuilderSection
            id="documents"
            number="03"
            eyebrow="Evidence"
            title="Supporting requirements"
            description="List only documents the citizen must upload with the request."
            action={<Button type="button" variant="secondary" onClick={() => setService({ ...service, requiredDocs: [...service.requiredDocs, 'New requirement'] })}><PlusIcon /> Add requirement</Button>}
          >
            <div className="space-y-3">
              {service.requiredDocs.map((document, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-border bg-brand-soft/25 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand">{index + 1}</span>
                  <input aria-label={`Document ${index + 1}`} className={inputClass} value={document} onChange={(event) => { const next = [...service.requiredDocs]; next[index] = event.target.value; setService({ ...service, requiredDocs: next }) }} />
                  <Button type="button" variant="danger" className="shrink-0" onClick={() => setService({ ...service, requiredDocs: service.requiredDocs.filter((_, item) => item !== index) })}>Remove</Button>
                </div>
              ))}
              {!service.requiredDocs.length ? <EmptyBuilderState title="No supporting documents required" description="Keep this empty when eVerify data and the form answers are sufficient." action="Add a requirement" onClick={() => setService({ ...service, requiredDocs: ['New requirement'] })} /> : null}
            </div>
          </BuilderSection>

          <BuilderSection
            id="rules"
            number="04"
            eyebrow="Local policy"
            title="Eligibility and fee waivers"
            description="Leave a condition blank when it does not apply. DICT bounds are checked on submission."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField label="Minimum age" suffix="years" value={service.eligibility.min_age} onChange={(value) => setService({ ...service, eligibility: { ...service.eligibility, min_age: value } })} />
              <NumberField label="Minimum residency" suffix="years" value={service.eligibility.min_residency_years} onChange={(value) => setService({ ...service, eligibility: { ...service.eligibility, min_residency_years: value } })} />
              <NumberField label="Maximum monthly income" prefix="₱" value={service.eligibility.max_monthly_income} onChange={(value) => setService({ ...service, eligibility: { ...service.eligibility, max_monthly_income: value } })} />
            </div>
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">Fee waivers</p>
                  <p className="mt-1 text-sm text-muted">Define who may receive a full or partial waiver.</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setService({ ...service, waivers: [...service.waivers, { category: 'student', label: 'Student', waives: 'full' }] })}><PlusIcon /> Add waiver</Button>
              </div>
              <div className="mt-4 space-y-3">
                {service.waivers.map((waiver, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-border bg-brand-soft/25 p-4 md:grid-cols-[1fr_1fr_0.7fr_auto] md:items-end">
                    <Field label="Category code"><input aria-label={`Waiver ${index + 1} category`} className={inputClass} value={waiver.category} onChange={(event) => updateWaiver(index, { category: event.target.value })} /></Field>
                    <Field label="Citizen-facing label"><input aria-label={`Waiver ${index + 1} label`} className={inputClass} value={waiver.label} onChange={(event) => updateWaiver(index, { label: event.target.value })} /></Field>
                    <Field label="Waiver type"><select aria-label={`Waiver ${index + 1} type`} className={inputClass} value={waiver.waives} onChange={(event) => updateWaiver(index, { waives: event.target.value as 'full' | 'partial' })}><option value="full">Full fee</option><option value="partial">Partial fee</option></select></Field>
                    <Button type="button" variant="danger" onClick={() => setService({ ...service, waivers: service.waivers.filter((_, item) => item !== index) })}>Remove</Button>
                  </div>
                ))}
                {!service.waivers.length ? <p className="rounded-xl bg-brand-soft/40 px-4 py-3 text-sm text-muted">No fee waivers configured.</p> : null}
              </div>
            </div>
          </BuilderSection>

          <BuilderSection
            id="template"
            number="05"
            eyebrow="Final step"
            title="Review and submit"
            description="Upload the official document layout used for issuance. Your configuration is validated before anything reaches citizens."
          >
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border-strong bg-brand-soft/30 px-5 py-8 text-center transition-colors hover:bg-brand-soft/60">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow-sm"><UploadIcon /></span>
              <span className="mt-4 block font-bold text-foreground">{file ? file.name : 'Choose the official PDF or DOCX template'}</span>
              <span className="mt-1 block text-sm text-muted">Maximum file size: 4 MB</span>
              <input type="file" className="sr-only" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <span className="mt-4 inline-flex h-9 items-center rounded-sm border border-brand bg-white px-4 text-sm font-bold text-brand">{file ? 'Replace file' : 'Browse files'}</span>
            </label>

            {error ? <div className="mt-4"><Toast tone="danger"><strong>Check this setup:</strong> {error}</Toast></div> : null}
            {saved ? (
              <div className="mt-4"><Toast tone="success"><strong>{saved.status === 'published' ? 'Published for citizens.' : 'Sent to DICT review.'}</strong> The saved service now appears in your LGU workspace.</Toast></div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <p className="max-w-md text-xs leading-5 text-muted">Submitting confirms that the details reflect your LGU policy. Blocking findings will be sent to a DICT reviewer.</p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={`${baseHref}/studio`} variant="ghost">Save and exit</ButtonLink>
                <Button className="h-11 px-6" disabled={busy || !service.name.trim() || !service.approvalOffice || !file || Boolean(saved)} onClick={submit}>{busy ? 'Validating…' : saved ? 'Submitted' : 'Validate and submit'}</Button>
              </div>
            </div>
            {saved ? <div className="mt-3 text-right"><ButtonLink href={baseHref} variant="secondary">Return to dashboard</ButtonLink></div> : null}
          </BuilderSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="bg-brand-soft px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Setup guide</p>
              <p className="mt-1 font-display text-xl text-foreground">Your service at a glance</p>
            </div>
            <nav aria-label="Manual service setup sections" className="p-2">
              {sections.map(([id, label], index) => (
                <a key={id} href={`#${id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-muted hover:bg-brand-soft hover:text-brand">
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-border text-[11px] text-brand">{index + 1}</span>
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-foreground">Ready to submit</p>
              <Badge tone={completed === readiness.length ? 'success' : 'neutral'}>{completed}/{readiness.length}</Badge>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(completed / readiness.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-3">
              {readiness.map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-xs leading-5 text-muted">
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${item.done ? 'border-brand bg-brand text-white' : 'border-border text-transparent'}`}>✓</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-surface-footer p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-soft">Bounded by design</p>
            <p className="mt-2 text-sm leading-6 text-white/75">You configure local policy inside a fixed DICT-approved flow. Validation catches anything outside those bounds.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function BuilderSection({
  id,
  number,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  id: string
  number: string
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-brand-soft/30 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-bold text-white">{number}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">{title}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function EmptyBuilderState({ title, description, action, onClick }: { title: string; description: string; action: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-brand-soft/20 px-5 py-7 text-center">
      <p className="font-bold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted">{description}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={onClick}><PlusIcon /> {action}</Button>
    </div>
  )
}

function makeDraft(template: ServiceTemplate | undefined, initial?: EditableService | null): GeneratedService {
  if (!template) return { templateCode: '', name: '', formFields: [], feeAmount: 0, waivers: [], requiredDocs: [], eligibility: {}, approvalOffice: null, confidence: 1 }
  return { templateCode: template.code, name: initial?.display_name ?? template.name, formFields: initial?.form_fields ?? template.base_fields, feeAmount: Number(initial?.fee_amount ?? 0), waivers: initial?.waivers ?? [], requiredDocs: initial?.required_docs ?? [], eligibility: initial?.eligibility ?? {}, approvalOffice: initial?.approval_office ?? null, confidence: 1 }
}

function NumberField({ label, value, prefix, suffix, onChange }: { label: string; value?: number; prefix?: string; suffix?: string; onChange: (value: number | undefined) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        {prefix ? <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-bold text-muted">{prefix}</span> : null}
        <input className={`${inputClass} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-14' : ''}`} type="number" min="0" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))} />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span> : null}
      </div>
    </Field>
  )
}

function BackIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="m15 18-6-6 6-6" /></svg>
}

function PlusIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M12 5v14M5 12h14" /></svg>
}

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
}

function UploadIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></svg>
}
