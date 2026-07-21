import { Badge, ButtonAnchor, Card, CardBody } from '@/components/ui'
import { egovMode } from '@/lib/egov/client'

export const metadata = { title: 'Sign in — eSee LGU' }

/**
 * One identity provider, two consoles.
 *
 * In live mode all three buttons hit the same eGovPH authorize URL and the role
 * comes back from the `officers` lookup — the persona parameter is ignored.
 * In mock mode it picks which seeded persona signs in, which is what makes the
 * two-role flow demonstrable when the sandbox is unavailable.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = '', error } = await searchParams
  const mock = egovMode('SSO') === 'mock'
  const q = (persona: string, fallback?: string) =>
    `/api/auth/egov/login?persona=${persona}&next=${encodeURIComponent(next || fallback || '')}`

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {error ? <SignInError error={error} /> : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-surface">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative order-2 overflow-hidden bg-brand px-6 py-8 text-white sm:px-10 sm:py-10 lg:order-1">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[44px] border-white/5"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full border-[52px] border-white/5"
            />

            <div className="relative mx-auto max-w-md lg:mx-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm text-brand">
                  e
                </span>
                eGovPH local services
              </div>
              <h1 className="mt-6 font-display text-3xl leading-tight sm:text-4xl">
                Your LGU services,
                <br />
                right where you are.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
                Find your city, municipality, or barangay and request official
                documents using your verified eGovPH identity.
              </p>

              <PhonePreview />
            </div>
          </section>

          <section className="order-1 flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
              Citizen access
            </p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-foreground">
              Start with your local government
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Sign in once with eGovPH. Your verified profile follows you, so
              you can spend less time filling forms and more time getting things
              done.
            </p>

            <ButtonAnchor
              href={q('citizen', '/citizen/services')}
              className="mt-7 h-12 w-full rounded-full text-base"
            >
              <LocationIcon />
              Browse my LGU
              <ArrowIcon />
            </ButtonAnchor>
            <p className="mt-3 text-center text-xs text-muted">
              Secure sign-in powered by your eGovPH account
            </p>

            <div className="my-7 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
                Government access
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ButtonAnchor
                href={q('officer', '/console')}
                variant="secondary"
                className="h-11"
              >
                LGU officer
              </ButtonAnchor>
              <ButtonAnchor
                href={q('reviewer', '/review')}
                variant="secondary"
                className="h-11"
              >
                DICT reviewer
              </ButtonAnchor>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Officer and reviewer access is assigned by DICT and cannot be
              self-selected during live sign-in.
            </p>
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

function PhonePreview() {
  return (
    <div className="mx-auto mt-8 aspect-[9/14] w-full max-w-[15rem] overflow-hidden rounded-[1.75rem] border-[5px] border-white/90 bg-[#f7f9fc] text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[9px] font-bold">
        <span>5:50</span>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span>◒</span>
          <span>▥</span>
          <span>▰</span>
        </div>
      </div>
      <div className="border-b border-border/60 bg-white px-4 pb-3 pt-1">
        <p className="text-[8px] font-bold uppercase tracking-widest text-brand">
          Local government
        </p>
        <div className="mt-1 flex items-end justify-between">
          <p className="font-display text-base leading-tight">
            Services near you
          </p>
          <span className="text-[9px] font-bold text-brand">View all</span>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <PhoneService
          icon="R"
          title="Municipality of Rosario"
          body="Official local government services"
        />
        <PhoneService
          icon="BP"
          title="Business permits"
          body="Applications and renewals"
        />
        <PhoneService
          icon="BC"
          title="Barangay certificates"
          body="Clearance, residency, indigency"
        />
      </div>
      <div className="mx-3 mt-1 rounded-lg bg-brand px-3 py-2.5 text-center text-[10px] font-bold text-white">
        Find my LGU
      </div>
      <div className="mt-3 flex justify-around border-t border-border/60 bg-white px-3 py-2 text-center text-[8px] text-muted">
        <span className="font-bold text-brand">
          ⌂<br />
          Home
        </span>
        <span>
          ▦<br />
          Services
        </span>
        <span>
          ▣<br />
          Requests
        </span>
      </div>
    </div>
  )
}

function PhoneService({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-white p-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-brand-soft text-[9px] font-bold text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-bold">{title}</span>
        <span className="block truncate text-[8px] text-muted">{body}</span>
      </span>
      <span className="text-base text-brand" aria-hidden="true">
        ›
      </span>
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
