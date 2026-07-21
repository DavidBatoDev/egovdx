import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Hand-rolled primitives rather than a component library, styled to the
 * eSee LGU design system (esee_lgu_design_system.md) — Royal Blue primary,
 * dense spacing, no shadows, no green. Everything here is a plain Tailwind
 * wrapper — no client JS, so these all render as server components.
 */

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ------------------------------------------------------------------ layout

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border bg-surface', className)}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-3 py-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('px-3 py-3', className)}>{children}</div>
}

/**
 * Georgia is reserved for page-level titles — the "this is a government
 * document" signal — and appears nowhere else in the UI. Everything else on
 * the page, including this header's own description, stays in Helvetica.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

// ----------------------------------------------------------------- buttons

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

// Destructive actions are outline-only, never filled — red means "danger",
// never "click me". Disabled state overrides every variant identically: a
// `disabled:` compound selector always outranks a plain variant class, so
// the override below wins regardless of class order.
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-brand bg-surface text-brand hover:bg-brand-soft',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'border border-danger bg-surface text-danger hover:bg-danger-soft',
}

const BUTTON_BASE =
  'inline-flex h-9 items-center justify-center gap-2 rounded-sm px-4 text-sm font-bold ' +
  'transition-colors disabled:cursor-not-allowed disabled:border-transparent ' +
  'disabled:bg-brand-soft disabled:text-border-strong disabled:hover:bg-brand-soft'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cn(BUTTON_BASE, BUTTON_STYLES[variant], className)}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={cn(BUTTON_BASE, BUTTON_STYLES[variant], className)} />
}

/** Native anchor for downloads and non-Next endpoints that must not be prefetched. */
export function ButtonAnchor({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: ButtonVariant }) {
  return <a {...props} className={cn(BUTTON_BASE, BUTTON_STYLES[variant], className)} />
}

// ------------------------------------------------------------------ badges

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'accent'

/**
 * No tone reads as green. The design system states this as a deliberate
 * government convention: success/verified/approved all render in the same
 * primary blue as the rest of the brand, not a different hue — see
 * `--success` in globals.css.
 */
const TONE_STYLES: Record<Tone, string> = {
  neutral: 'border border-border bg-surface text-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold',
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Says out loud whether a panel's data came from the live sandbox or a fixture.
 *
 * This exists for honesty under demo conditions: if eVerify falls back, the
 * screen should not imply PhilSys confirmed anything. Per the design system,
 * a live result needs no badge at all — silence is the expected state; only
 * mock and fallback data are called out, and never softened into a success
 * color.
 */
export function SourceBadge({ source }: { source: 'live' | 'mock' | 'fallback' }) {
  if (source === 'live') return <Badge tone="brand">Live API</Badge>
  if (source === 'fallback') return <Badge tone="warn">Offline — using cached data</Badge>
  return <Badge tone="warn">Mock data — demo only</Badge>
}

const STATUS_TONE: Record<string, Tone> = {
  published: 'success',
  issued: 'success',
  approved: 'brand',
  submitted: 'brand',
  draft: 'neutral',
  flagged: 'warn',
  rejected: 'danger',
  paid: 'success',
  waived: 'accent',
  unpaid: 'warn',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} className="uppercase tracking-wide">
      {status}
    </Badge>
  )
}

// ------------------------------------------------------------------ fields

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-foreground">
        {label}
        {required ? <span className="text-danger">*</span> : null}
        {hint}
      </span>
      {children}
    </label>
  )
}

/** Rich-black border for strong input contrast — deliberately not the same
 * soft blue-300 used for card/table borders (see `--border-input`). */
export const inputClass =
  'w-full rounded-sm border border-border-input bg-surface px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted/70 disabled:bg-surface-muted disabled:text-muted'

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  )
}

// ------------------------------------------------------------------ tables

/**
 * Tables are the primary data display for the officer workspace — dense and
 * scannable, favored over cards wherever rows share the same shape. Compose
 * with plain `<tr>`/`<th>`/`<td>` semantics via Th/Td so callers keep full
 * control of column content.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-brand-soft">
      <tr>{children}</tr>
    </thead>
  )
}

/** Alternating stripe on body rows only — the header row never stripes. */
export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&>tr:nth-child(even)]:bg-brand-soft/40">{children}</tbody>
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <tr className={cn('border-b border-border last:border-b-0 hover:bg-border', className)}>
      {children}
    </tr>
  )
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('px-3 py-2 text-[13px] font-bold text-foreground', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 text-sm text-foreground', className)}>{children}</td>
}

// ------------------------------------------------------- citizen primitives

export function Tabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return <nav aria-label="Citizen sections" className="flex gap-1 overflow-x-auto border-b border-border">{items.map((item) => <Link key={item.href} href={item.href} aria-current={active === item.href ? 'page' : undefined} className={cn('whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold', active === item.href ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-brand')}>{item.label}</Link>)}</nav>
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return <ol aria-label="Application progress" className="grid gap-2 sm:grid-cols-5">{steps.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined} className={cn('rounded-sm border px-3 py-2 text-xs font-bold', index < current ? 'border-brand bg-brand-soft text-brand' : index === current ? 'border-brand bg-brand text-white' : 'border-border text-muted')}><span className="mr-1">{index + 1}.</span>{step}</li>)}</ol>
}

export function FileUpload(props: ComponentProps<'input'>) {
  return <input {...props} type="file" className={cn(inputClass, 'file:mr-3 file:rounded-sm file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:font-bold file:text-brand', props.className)} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-sm bg-brand-soft', className)} />
}

export function Toast({ tone = 'brand', children }: { tone?: Tone; children: ReactNode }) {
  return <div role="status" className={cn('rounded-sm border px-4 py-3 text-sm', TONE_STYLES[tone])}>{children}</div>
}

export function Modal({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"><Card className="w-full max-w-lg"><CardHeader title={title} /><CardBody className="space-y-4">{children}{footer ? <div className="flex justify-end gap-2 border-t border-border pt-3">{footer}</div> : null}</CardBody></Card></div>
}
