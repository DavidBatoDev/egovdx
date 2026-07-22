import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Badge, ButtonAnchor, Card, CardBody } from '@/components/ui'
import { safeNextForRole, type AuthenticatedRole } from '@/lib/auth/state'
import { egovMode } from '@/lib/egov/client'

export const metadata = { title: 'Sign in — eSee LGU' }

/**
 * One identity provider, role-specific government workspaces.
 *
 * In live mode all three buttons hit the same eGovPH authorize URL and the role
 * comes back from the `officers` lookup — the persona parameter is ignored.
 * In mock mode it picks which seeded persona signs in, which is what makes the
 * role-specific flow demonstrable when the sandbox is unavailable.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = '', error } = await searchParams
  const mock = egovMode('SSO') === 'mock'

  // Production users arrive only through the eGovPH-registered callback.
  // Keep this local persona chooser out of the live agency site.
  if (!mock) redirect('/')

  const q = (persona: AuthenticatedRole, fallback: string) => {
    const destination = safeNextForRole(next, persona, fallback)
    return `/api/auth/egov/login?persona=${persona}&next=${encodeURIComponent(destination)}`
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {error ? <SignInError error={error} /> : null}

      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[0_20px_60px_rgba(0,50,160,0.08)]">
        <div className="grid lg:grid-cols-[1.45fr_0.85fr]">
          <section className="relative overflow-hidden bg-brand-soft px-6 py-8 sm:px-10 sm:py-10">
            <div
              aria-hidden="true"
              className="absolute -left-24 -top-24 h-72 w-72 rounded-full border-[52px] border-white/50"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 right-10 h-80 w-80 rounded-full border-[58px] border-white/40"
            />

            <div className="relative grid items-center gap-8 sm:grid-cols-[1fr_15rem]">
              <div className="max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand">
                  <CitizenIcon />
                  Citizen access
                </div>
                <h1 className="mt-5 font-display text-3xl leading-tight text-foreground sm:text-4xl">
                  Explore your LGU services
                </h1>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Find services from your city, municipality, or barangay. Use
                  your verified eGovPH identity to request documents without
                  re-entering information the government already has.
                </p>

                <ButtonAnchor
                  href={q('citizen', '/citizen/services')}
                  className="mt-7 h-12 w-full rounded-full text-base sm:w-auto sm:min-w-64"
                >
                  <LocationIcon />
                  Browse my LGU
                  <ArrowIcon />
                </ButtonAnchor>
                <p className="mt-3 text-xs text-muted">
                  Secure sign-in with your eGovPH account
                </p>
              </div>

              <div className="mx-auto w-full max-w-[15rem] rounded-[2rem] border-[6px] border-white bg-white p-1.5 shadow-[0_24px_55px_rgba(19,51,109,0.22)]">
                <Image
                  src="/brand/egovph-local-government.png"
                  alt="eGovPH mobile app showing local government portals and My LGU services"
                  width={480}
                  height={1056}
                  priority
                  className="h-auto w-full rounded-[1.35rem]"
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center border-t border-border px-6 py-8 sm:px-10 sm:py-10 lg:border-l lg:border-t-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
              Government access
            </p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-foreground">
              Serve your community
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Access is limited to roles assigned by DICT. Use the same eGovPH
              account to configure services or review exceptions.
            </p>

            <div className="mt-7 space-y-4">
              <div className="rounded-xl border border-border bg-surface p-3">
                <ButtonAnchor
                  href={q('officer', '/lgu')}
                  className="h-12 w-full justify-start rounded-lg text-base"
                >
                  <OfficeIcon />
                  LGU officer
                  <ArrowIcon />
                </ButtonAnchor>
                <p className="px-2 pb-1 pt-3 text-xs leading-5 text-muted">
                  Configure and publish bounded local eServices, then process
                  citizen requests.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface p-3">
                <ButtonAnchor
                  href={q('reviewer', '/review')}
                  variant="secondary"
                  className="h-12 w-full justify-start rounded-lg text-base"
                >
                  <ReviewIcon />
                  DICT reviewer
                  <ArrowIcon />
                </ButtonAnchor>
                <p className="px-2 pb-1 pt-3 text-xs leading-5 text-muted">
                  Review configurations that fall outside automated approval
                  bounds.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-xl bg-brand-soft p-4 text-xs leading-5 text-brand">
              <LockIcon />
              <p>
                Your role is verified after sign-in. Government access cannot be
                self-selected.
              </p>
            </div>
          </section>
        </div>
      </div>

      {mock ? (
        <Card className="border-warn/30 bg-warn-soft">
          <CardBody className="flex items-start gap-3 text-sm text-warn">
            <Badge tone="warn">Mock SSO</Badge>
            <p>
              Demo personas are active. Sign-in does not contact eGovPH until
              <code className="mx-1 font-mono">EGOV_SSO_MODE=live</code>.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function SignInError({ error }: { error: string }) {
  const message =
    error === 'database_unavailable'
      ? 'The sign-in service cannot reach its role directory. Please try again shortly.'
      : error === 'sso_handoff_required'
        ? 'Start sign-in from eGovPH so it can securely hand this service a short-lived code.'
        : error === 'missing_exchange_code'
          ? 'The eGovPH handoff did not include a valid exchange code. Please start again.'
          : error === 'sso_unavailable'
            ? 'eGovPH sign-in is temporarily unavailable. No fallback session was created.'
            : `Sign-in failed (${error}). Please try again.`

  return (
    <Card className="border-danger/30 bg-danger-soft">
      <CardBody className="text-sm text-danger">
        <p className="font-bold">We couldn&apos;t sign you in</p>
        <p className="mt-1">{message}</p>
      </CardBody>
    </Card>
  )
}

function LocationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current stroke-2"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function CitizenIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current stroke-2"
    >
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

function OfficeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-2"
    >
      <path d="M3 9h18M5 9V6l7-3 7 3v3M5 19h14M7 9v10m5-10v10m5-10v10M3 22h18" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current stroke-2"
    >
      <path d="M7 3h10v4H7zM5 5H4a1 1 0 0 0-1 1v15h18V6a1 1 0 0 0-1-1h-1" />
      <path d="m8 14 2.5 2.5L16 11" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-current stroke-2"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="ml-auto h-4 w-4 fill-none stroke-current stroke-2"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
