import Link from 'next/link'
import { ButtonAnchor, ButtonLink, cn } from '@/components/ui'

/**
 * eSee LGU marketing landing page.
 *
 * Structured to the pitch's four required components — Problem Statement,
 * Proposed Solution & Integration to eGovPH, Impact/Value/Cost Benefit, and
 * Implementation & Scalability — so the page walks a DICT/LGU decision-maker
 * through the whole case. Built in the eSee LGU design system: Royal Blue,
 * Georgia headings, dense spacing, borders over shadows.
 *
 * Every primary CTA routes to officer sign-in. Pure presentation, no client JS,
 * so unification is a one-import move.
 */

const OFFICER_SIGNIN = '/signin?next=/console'
const CITIZEN_SIGNIN = '/signin?next=/citizen/services'
const REVIEWER_SIGNIN = '/signin?next=/review'

// ------------------------------------------------------------------ helpers

function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className={cn(
        'text-[13px] font-bold uppercase tracking-wide',
        onDark ? 'text-accent' : 'text-brand',
      )}
    >
      {children}
    </p>
  )
}

/** Recurring section header: a large Georgia heading left, eyebrow + short
 *  description right, a hairline rule beneath. */
function SectionHeader({
  heading,
  eyebrow,
  description,
}: {
  heading: string
  eyebrow: string
  description: string
}) {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h2 className="max-w-2xl font-display text-3xl leading-tight text-foreground md:text-[40px]">
          {heading}
        </h2>
        <div className="max-w-md space-y-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-6 h-px w-full bg-border" />
    </div>
  )
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('mx-auto w-full max-w-6xl px-6 py-16 md:py-20', className)}>
      {children}
    </section>
  )
}

// ------------------------------------------------------------------- content

const PROBLEM_FACTS = [
  {
    title: 'Reported reach overstates access',
    body: 'For most “integrated” LGUs, that means a link on eGovPH that redirects to an external municipal site — many with no working eServices at all.',
  },
  {
    title: 'Barangays are not in the count',
    body: 'The figure tracks city and municipal halls only — not the barangays where Filipinos get clearances, certificates of indigency, and residency records.',
  },
  {
    title: 'Central teams can’t hand-build it',
    body: 'DICT cannot author and maintain bespoke workflows for 1,634 municipalities, let alone the barangays beneath them, each with its own fees and rules.',
  },
]

const FLOW_STEPS = ['Request', 'Verification', 'Approval', 'Fee assessment', 'Issuance']

const INTEGRATIONS = [
  { api: 'eGov PH', role: 'One sign-on for two roles — the LGU officer’s console and the citizen’s request flow.' },
  { api: 'eVerify', role: 'Pulls verified name, address, and birthdate straight from PhilSys — the citizen retypes nothing.' },
  { api: 'Face Liveness', role: 'A live selfie at request time replaces the officer seeing the applicant at the counter.' },
  { api: 'eGov AI', role: 'Turns a plain-language prompt — or an uploaded paper form — into a structured eService.' },
  { api: 'eGov Pay', role: 'Collects the configured fee in-app, a named stage of the core flow.' },
  { api: 'eMessage', role: '“Your document is ready” by SMS — no return trip to the hall to ask.' },
  { api: 'eGov chain', role: 'Anchors each issued PDF’s hash on-chain; a QR anyone can verify in seconds.' },
]

const BENEFICIARIES = [
  {
    who: 'For the citizen',
    headline: 'One trip becomes zero',
    points: [
      'Identity auto-filled from PhilSys',
      'No return trip to ask if it is ready',
      'Verifiable, tamper-evident PDF',
      'Pay the fee inside eGovPH',
      'SMS the moment it issues',
    ],
    cta: 'Browse services',
    href: '/citizen/services',
  },
  {
    who: 'For the barangay',
    headline: 'No retyping, ever',
    points: [
      'The template fills itself on approval',
      'Letterhead, seal, control number kept',
      'No manual issuance or filing',
      'Requests routed to the right office',
      'Configure without a contractor',
    ],
    cta: 'Officer sign-in',
    href: OFFICER_SIGNIN,
    featured: true,
  },
  {
    who: 'For DICT',
    headline: 'Review, don’t build',
    points: [
      'Approve pre-structured submissions',
      'Conforming services publish fast',
      'Anomalies route to a reviewer',
      'Approval authority stays central',
      'A force multiplier, not a rival',
    ],
    cta: 'DICT review',
    href: '/review',
  },
]

const LGU_VALUE = [
  'Zero procurement cycle',
  'No cost to the LGU',
  'Faster time-to-live',
  'Local policy control',
]

const SCALE_STEPS = [
  {
    title: 'Register the LGU',
    body: 'Sign in with eGovPH and look the LGU up against PSA geographic data.',
  },
  {
    title: 'Configure within bounds',
    body: 'Set fees, waivers, eligibility, and fields — or upload a paper form and confirm.',
  },
  {
    title: 'Publish to eGovPH',
    body: 'Conforming services go live immediately; anomalies wait for a reviewer.',
  },
]

const LIMITS = [
  {
    title: 'It needs connectivity',
    body: 'A cloud, AI-assisted tool depends on decent internet. Offline and low-bandwidth capture is phase two, not this build.',
  },
  {
    title: 'The AI can misparse',
    body: 'Which is exactly why the review queue exists. We do not claim zero-error parsing; a human clears anything unusual before publish.',
  },
  {
    title: 'Barangay data has gaps',
    body: 'Where eGovPH lacks local residency history, the barangay’s own records stay the source of truth until they are digitized.',
  },
]

const GET_STARTED = [
  { title: 'Citizen services', body: 'Find an LGU service and submit a verified request', href: CITIZEN_SIGNIN },
  { title: 'Officer console', body: 'Sign in and configure a service', href: OFFICER_SIGNIN },
  { title: 'DICT review', body: 'Clear anything automated validation flags', href: REVIEWER_SIGNIN },
]

// --------------------------------------------------------------------- page

export function LandingPage() {
  return (
    // Full-bleed escape: the harness renders inside a centered max-w container
    // with px-4 py-8 padding. A landing page needs to reach the viewport edges
    // and sit flush under the nav, so we break out horizontally (w-screen +
    // centered) and cancel the container's vertical padding (-my-8).
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-surface">
      {/* ============================================================ HERO */}
      {/* The illustration sets the hero height at its natural aspect ratio, so
          the whole scene — banners, barangay hall, the queue — shows uncropped
          and edge-to-edge at any width. On md+ the copy is overlaid and centered
          with a white scrim for legibility; on mobile it stacks below the image
          so it can never overflow a short image. */}
      <section className="relative isolate bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/Landing hero scene.png"
          alt=""
          aria-hidden
          className="block w-full"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              'radial-gradient(ellipse 66% 62% at 50% 45%, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.92) 44%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0) 90%), linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2))',
          }}
        />
        <div className="relative px-6 pb-14 pt-8 text-center md:absolute md:inset-0 md:flex md:flex-col md:items-center md:justify-center md:py-0">
          <div className="mx-auto flex max-w-3xl flex-col items-center">
            <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
              Digital government services, in bounds
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-foreground md:text-[52px]">
              Each LGU configures its own eServices, in bounds
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              Remove the per-locality configuration labour without removing a single
              point of government oversight.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ButtonAnchor href={OFFICER_SIGNIN} className="h-12 px-6 text-base">
                Officer sign-in
              </ButtonAnchor>
              <ButtonLink href="#how" variant="secondary" className="h-12 px-6 text-base">
                See how it works
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================== 1 · PROBLEM STATEMENT */}
      <Section>
        <SectionHeader
          heading="Adoption is stalling on configuration, not software"
          eyebrow="Problem Statement"
          description="The national eLGU rollout looks further along than it is — and it doesn’t reach where citizens actually transact."
        />
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PROBLEM_FACTS.map((fact, i) => (
            <article key={fact.title} className="rounded-md border border-border p-6">
              <p className="font-display text-3xl text-brand">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 text-lg font-bold text-foreground">{fact.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{fact.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-md border border-brand/20 bg-brand-soft p-6 md:p-8">
          <p className="font-display text-xl leading-relaxed text-foreground md:text-2xl">
            Adoption stalls not because software is hard to build, but because configuring
            it per-locality doesn’t scale under a fully centralized model.
          </p>
        </div>
      </Section>

      {/* ============================ 2 · PROPOSED SOLUTION & eGovPH INTEGRATION */}
      <section id="how" className="scroll-mt-16 border-y border-border bg-brand-soft/40">
        <Section className="py-16 md:py-20">
          <SectionHeader
            heading="A bounded configuration layer on eGovPH’s own rails"
            eyebrow="Proposed Solution & Integration to eGovPH"
            description="One fixed, DICT-approved flow. LGUs configure fees, waivers, eligibility, and fields within bounds — they don’t author workflows."
          />

          {/* the fixed, centrally-defined flow */}
          <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-3">
            {FLOW_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-brand ring-1 ring-brand/25">
                  {step}
                </span>
                {i < FLOW_STEPS.length - 1 ? (
                  <span className="text-brand" aria-hidden>
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            The AI drafts a service from a prompt or a paper form and validates it against
            the DICT template. Conforming services publish immediately; anything outside
            the bounds is flagged for a human reviewer — then renders natively inside
            eGovPH, with no external redirect.
          </p>

          {/* seven load-bearing integrations */}
          <h3 className="mt-12 text-lg font-bold text-foreground">
            Seven eGovPH integrations, each load-bearing
          </h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map((item) => (
              <div key={item.api} className="rounded-md border border-border bg-surface p-5">
                <p className="text-sm font-bold text-brand">{item.api}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.role}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center rounded-md bg-brand p-5 text-white">
              <p className="font-display text-lg leading-snug">All seven, all load-bearing</p>
              <p className="mt-2 text-sm text-white/80">
                Every integration is visible in the demo — none is decorative.
              </p>
            </div>
          </div>
        </Section>
      </section>

      {/* ================================ 3 · IMPACT, VALUE & COST BENEFIT */}
      <section className="bg-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/rule-nav.svg" alt="" aria-hidden className="h-2 w-full object-cover" />
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow onDark>Impact, Value &amp; Cost Benefit</Eyebrow>
            <h2 className="mt-3 font-display text-3xl leading-tight text-white md:text-[40px]">
              One trip becomes zero. Bespoke builds become reviews.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-white/80">
              Value lands on every side of the counter — and it costs the LGU nothing.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {BENEFICIARIES.map((tier) => (
              <article
                key={tier.who}
                className={cn(
                  'flex flex-col rounded-md border bg-surface p-6',
                  tier.featured ? 'border-accent ring-2 ring-accent' : 'border-border',
                )}
              >
                <p className="text-[13px] font-bold uppercase tracking-wide text-brand">{tier.who}</p>
                <p className="mt-3 font-display text-2xl text-foreground">{tier.headline}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-muted">
                      <span className="mt-0.5 text-brand">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={tier.href}
                  variant={tier.featured ? 'primary' : 'secondary'}
                  className="mt-6 h-11 w-full text-base"
                >
                  {tier.cta}
                </ButtonLink>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-white/25 p-6">
              <p className="text-sm font-bold text-white">For the LGU</p>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {LGU_VALUE.map((v) => (
                  <li key={v} className="flex items-center gap-2 text-sm text-white/85">
                    <span className="text-accent">✓</span>
                    {v}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-white/25 p-6">
              <p className="text-sm font-bold text-white">What we measure</p>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Time-to-live from prompt to published service, and the review-flag rate —
                the share passing automated validation without a human. That last number
                is the real signal of how much DICT labour the tool removes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 4 · IMPLEMENTATION & SCALABILITY */}
      <Section>
        <SectionHeader
          heading="Scaling is a database row, not a deployment"
          eyebrow="Implementation & Scalability"
          description="A new LGU registers, configures, and publishes — nobody ships code, and nothing redeploys."
        />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <ol className="space-y-4">
              {SCALE_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-foreground">{s.title}</p>
                    <p className="text-sm text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted">
              Seven eGovPH APIs, each load-bearing. Published services render natively
              inside eGovPH — no external redirect, no app release.
            </p>
          </div>

          {/* Naming the limits before a judge finds them reads as competence. */}
          <div className="rounded-md border border-border bg-brand-soft/50 p-6 md:p-8">
            <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
              What we’re not claiming
            </p>
            <div className="mt-4 space-y-4">
              {LIMITS.map((l) => (
                <div key={l.title}>
                  <p className="text-sm font-bold text-foreground">{l.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{l.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ===================================================== POSITIONING */}
      <section className="border-y border-border bg-brand-soft/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <blockquote className="font-display text-2xl leading-relaxed text-foreground md:text-3xl">
            “We are not removing government oversight. We’re removing the manual
            configuration labour that currently makes oversight the bottleneck.”
          </blockquote>
          <p className="mt-5 text-sm font-bold text-brand">eSee LGU — project positioning</p>
        </div>
      </section>

      {/* ===================================================== GET STARTED */}
      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <h2 className="font-display text-3xl leading-tight text-foreground md:text-[40px]">
              Choose your eGovPH role
            </h2>
            <div className="space-y-3">
              {GET_STARTED.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="flex items-center gap-4 rounded-md border border-border p-4 transition-colors hover:bg-brand-soft"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    →
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-foreground">{item.title}</span>
                    <span className="block text-sm text-muted">{item.body}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-8">
            <Eyebrow>Onboard your LGU</Eyebrow>
            <h3 className="mt-2 font-display text-2xl text-foreground">Bring your barangay online</h3>
            <p className="mt-2 text-sm text-muted">
              Sign in with the same eGovPH account your citizens use. Your role is
              assigned by DICT — configuration begins the moment you land.
            </p>
            <div className="mt-6 space-y-3">
              <div className="rounded-sm border border-border-input px-3 py-2 text-sm text-muted">
                Official name
              </div>
              <div className="rounded-sm border border-border-input px-3 py-2 text-sm text-muted">
                Official email
              </div>
              <div className="rounded-sm border border-border-input px-3 py-2 text-sm text-muted">
                Your LGU or barangay
              </div>
              <ButtonAnchor href={OFFICER_SIGNIN} className="h-11 w-full text-base">
                Request onboarding
              </ButtonAnchor>
            </div>
          </div>
        </div>
      </Section>

    </div>
  )
}
