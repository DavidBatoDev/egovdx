import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Hand-rolled primitives rather than a component library.
 *
 * The whole app needs about six of these, and pulling in a library would cost
 * setup time and a dependency we'd use 5% of. Everything here is a plain
 * Tailwind wrapper — no client JS, so these all render as server components.
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
    <div
      className={cn(
        'rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,21,28,0.04)]',
        className,
      )}
    >
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
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
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
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

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
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
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

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-border bg-surface text-foreground hover:bg-brand-soft',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

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

// ------------------------------------------------------------------ badges

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'accent'

const TONE_STYLES: Record<Tone, string> = {
  neutral: 'bg-background text-muted border-border',
  brand: 'bg-brand-soft text-brand border-brand/20',
  success: 'bg-success-soft text-success border-success/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  accent: 'bg-accent-soft text-accent border-accent/25',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
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
 * screen should not imply PhilSys confirmed anything. It also happens to be
 * good for the pitch — a judge can see which integrations are genuinely firing.
 */
export function SourceBadge({ source }: { source: 'live' | 'mock' | 'fallback' }) {
  if (source === 'live') return <Badge tone="success">Live API</Badge>
  if (source === 'fallback') return <Badge tone="warn">Sandbox unreachable — fixture</Badge>
  return <Badge tone="neutral">Mock data</Badge>
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
    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
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
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-danger">*</span> : null}
        {hint}
      </span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm ' +
  'placeholder:text-muted/60 disabled:bg-background disabled:text-muted'

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  )
}
