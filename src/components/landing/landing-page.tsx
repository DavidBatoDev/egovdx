import Link from 'next/link'
import { ButtonLink, cn } from '@/components/ui'

/**
 * eSee LGU marketing landing page.
 *
 * Structured to the pitch's four required components — Problem Statement,
 * Proposed Solution & Integration to eGovPH, Impact/Value/Cost Benefit, and
 * Implementation & Scalability — but written in plain, human language. The
 * story: a small, easy-to-use tool for local offices, multiplied across every
 * barangay, gives millions of Filipinos their time back. Kept lean and
 * scannable; the detail lives in the demo video.
 *
 * Every primary CTA routes to officer sign-in. Pure presentation, no client JS,
 * so unification is a one-import move.
 */

const SIGNIN = '/signin'
const OFFICER_SIGNIN = '/signin?next=/lgu'

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

/** Recurring section header: a large Georgia heading left, eyebrow + one-line
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

/** Compact horizontal stepper — one scannable line, no prose. */
function Stepper({ steps, center = false }: { steps: string[]; center?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-3', center && 'justify-center')}>
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <span className="rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-brand ring-1 ring-brand/25">
            {step}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-brand" aria-hidden>
              →
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------- content

const PROBLEM_FACTS = [
  { title: 'The line starts before the office opens', body: 'People take a day off, commute, wait — and still get told to come back tomorrow.' },
  { title: 'Barangays are last to go digital', body: 'The offices people visit most, for clearances and certificates, are still stuck on paper.' },
  { title: 'Going online is slow and costly', body: 'The old way needs contractors, months, and a budget most LGUs simply don’t have.' },
]

const FLOW_STEPS = ['Apply', 'Verify', 'Approve', 'Pay', 'Issue']

const INTEGRATIONS = [
  { plain: 'Same eGovPH sign-in', api: 'eGov PH' },
  { plain: 'Your ID fills in the form', api: 'eVerify' },
  { plain: 'A selfie proves it’s you', api: 'Face Liveness' },
  { plain: 'Your words become a form', api: 'eGov AI' },
  { plain: 'Pay online — GCash, Maya, bank', api: 'eGov Pay' },
  { plain: 'A text when it’s ready', api: 'eMessage' },
  { plain: 'A QR anyone can verify', api: 'eGov chain' },
]

const BENEFICIARIES = [
  {
    who: 'For the citizen',
    headline: 'A day back, every time',
    blurb: 'Request from home and download the finished document — no commute, no line, no coming back tomorrow.',
    cta: 'Browse services',
    href: '/citizen/services',
  },
  {
    who: 'For the barangay',
    headline: 'Serve everyone, with less work',
    blurb: 'The document fills itself in — no retyping, no filing. Set up a new service without a developer.',
    cta: 'Officer sign-in',
    href: OFFICER_SIGNIN,
    featured: true,
  },
  {
    who: 'For DICT',
    headline: 'Reach every town, keep control',
    blurb: 'One tool serves every LGU. Safe services publish instantly; oversight always stays with you.',
    cta: 'DICT review',
    href: '/review',
  },
]

const SCALE_STEPS = ['Sign up your LGU', 'Set up your services', 'Publish to eGovPH']

const LIMITS = [
  { title: 'Needs internet', body: 'offline use is coming later.' },
  { title: 'AI isn’t perfect', body: 'a person checks anything unusual before it goes live.' },
  { title: 'Not everything’s digital yet', body: 'the barangay’s own records stay official until they are.' },
]

const GET_STARTED = [
  { title: 'LGU workspace', body: 'Sign in and set up a service', href: OFFICER_SIGNIN },
  { title: 'DICT review', body: 'Review flagged services', href: '/review' },
  { title: 'Public verification', body: 'Check if a document is real', href: '/verify' },
]

// --------------------------------------------------------------------- page

export function LandingPage({ liveSso = false }: { liveSso?: boolean }) {
  const beneficiaries = liveSso
    ? BENEFICIARIES.filter((tier) => tier.who === 'For the citizen')
    : BENEFICIARIES
  const getStarted = liveSso
    ? GET_STARTED.filter((item) => item.title === 'Public verification')
    : GET_STARTED

  return (
    // Full-bleed escape: the harness renders inside a centered max-w container
    // with px-4 py-8 padding. A landing page needs to reach the viewport edges
    // and sit flush under the nav, so we break out horizontally (w-screen +
    // centered) and cancel the container's vertical padding (-my-8).
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-surface">
      {/* ============================================================ HERO */}
      {/* The illustration sets the hero height at its natural aspect ratio, so
          the whole scene shows uncropped and edge-to-edge at any width. On md+
          the copy is overlaid and centered with a white scrim for legibility;
          on mobile it stacks below the image so it can never overflow. */}
      <section className="relative isolate bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/Landing hero scene.png" alt="" aria-hidden className="block w-full" />
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
              Local government, finally online
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-foreground md:text-[52px]">
              One document shouldn’t cost a whole day
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              eSee LGU lets any barangay or city hall put its services online in minutes —
              so Filipinos can request and receive their documents from home, not from a line.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {!liveSso ? (
                <ButtonLink href={OFFICER_SIGNIN} className="h-12 px-6 text-base">
                  Officer sign-in
                </ButtonLink>
              ) : null}
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
          heading="Right now, one piece of paper can cost a whole day"
          eyebrow="Problem Statement"
          description="Line up before dawn, commute, wait — just to get a single document from the barangay."
        />
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PROBLEM_FACTS.map((fact, i) => (
            <article key={fact.title} className="rounded-md border border-border p-6">
              <p className="font-display text-3xl text-brand">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 text-lg font-bold text-foreground">{fact.title}</h3>
              <p className="mt-2 text-sm text-muted">{fact.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ============================ 2 · PROPOSED SOLUTION & eGovPH INTEGRATION */}
      {/* Royal Blue dotted-grid backdrop: white cards float above faint white
          dots, a cleaner, calmer surface than a flat fill. */}
      <section
        id="how"
        className="scroll-mt-16"
        style={{
          backgroundColor: '#0032A0',
          backgroundImage: 'radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px)',
          backgroundSize: '15px 15px',
        }}
      >
        <Section className="py-16 md:py-20">
          {/* centered intro */}
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow onDark>Proposed Solution &amp; Integration to eGovPH</Eyebrow>
            <h2 className="mt-3 font-display text-3xl leading-tight text-white md:text-[40px]">
              Describe a service — it’s online in minutes
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              An officer writes what they need in plain words. eSee LGU builds the form
              and publishes it inside eGovPH — no developers, no waiting.
            </p>
          </div>

          {/* the approved path — centered in a clean white card that floats on the dots */}
          <div className="mx-auto mt-12 max-w-3xl rounded-lg border border-border bg-surface p-6 text-center md:p-8">
            <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
              Every request, one simple path
            </p>
            <div className="mt-5 flex justify-center">
              <Stepper steps={FLOW_STEPS} center />
            </div>
          </div>

          {/* seven eGovPH services */}
          <h3 className="mt-16 text-center text-lg font-bold text-white">
            Built on seven eGovPH services people already trust
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map((item) => (
              <div key={item.api} className="rounded-md border border-border bg-surface p-5">
                <p className="text-sm font-bold text-foreground">{item.plain}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-brand">{item.api}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center rounded-md bg-accent p-5 text-black">
              <p className="font-display text-lg leading-snug">Seven services, one simple flow</p>
              <p className="mt-1 text-sm text-black/70">You’ll see each one live in the demo.</p>
            </div>
          </div>
        </Section>
      </section>

      {/* ================================ 3 · IMPACT, VALUE & COST BENEFIT */}
      {/* Reversed from the blue solution section into clean white for contrast.
          The Philippine ripple map anchors the left; the three audiences read
          as a scannable stack on the right, with the officer path highlighted
          in Royal Blue as the primary CTA. */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Impact, Value &amp; Cost Benefit</Eyebrow>
            <h2 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-[40px]">
              A small tool for LGUs. A day back for millions of Filipinos.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted">
              Make it easy for one office, and the whole country feels it — thousands of
              hours of people’s time saved every year, at no cost to the LGU.
            </p>
          </div>

          <div className="mt-12 grid items-center gap-10 md:grid-cols-2 md:gap-12">
            {/* Left — the reach: one tool rippling out to every town on the map.
                The source art is a wide frame with the archipelago centered in
                whitespace, so we crop to a portrait window (object-cover) to zoom
                the map up to the height of the card stack beside it. */}
            <div className="mx-auto aspect-4/5 w-full max-w-md overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/3.png"
                alt="eSee LGU reaching local government units rippling out across a map of the Philippines"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* Right — the three audiences, each a scannable card that links out. */}
            <div className="space-y-4">
              {beneficiaries.map((tier) => (
                <Link
                  key={tier.who}
                  href={tier.href}
                  className={cn(
                    'group block rounded-md border p-5 transition-colors',
                    tier.featured
                      ? 'border-brand bg-brand hover:bg-brand-hover'
                      : 'border-border bg-surface hover:border-brand/40',
                  )}
                >
                  <p
                    className={cn(
                      'text-[13px] font-bold uppercase tracking-wide',
                      tier.featured ? 'text-accent' : 'text-brand',
                    )}
                  >
                    {tier.who}
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 font-display text-xl',
                      tier.featured ? 'text-white' : 'text-foreground',
                    )}
                  >
                    {tier.headline}
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 text-sm',
                      tier.featured ? 'text-white/85' : 'text-muted',
                    )}
                  >
                    {tier.blurb}
                  </p>
                  <span
                    className={cn(
                      'mt-3 inline-flex items-center gap-1.5 text-sm font-bold',
                      tier.featured ? 'text-white' : 'text-brand',
                    )}
                  >
                    {tier.cta}
                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 4 · IMPLEMENTATION & SCALABILITY */}
      {/* The queue this product ends, grounded across the section as a framed
          backdrop. A centered intro sits on a clean top scrim; all detail lives
          in one solid panel so the photo frames it instead of ghosting behind
          separate cards. */}
      <section className="relative isolate overflow-hidden bg-surface">
        {/* Queue faded with a bottom-weighted mask: faintly present from the very
            top and building steadily to its strongest in the bottom ~10%, so the
            woven band and standing figures ground the section. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/The queue.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-bottom opacity-40"
          style={{
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.85) 92%, #000 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.85) 92%, #000 100%)',
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Implementation &amp; Scalability</Eyebrow>
            <h2 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-[40px]">
              Easy for one LGU. Ready for all of them.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Sign in, set up your services, publish. Nothing to install — and it works
              the same for the next thousand towns.
            </p>
          </div>

          {/* One solid panel: steps left, limits right, split by a hairline. Kept
              opaque so the queue never bleeds through the content. */}
          <div className="mt-12 max-w-4xl rounded-lg border border-border bg-surface p-6 md:p-10">
            <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border">
              <div className="md:pr-10">
                <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
                  Live in three steps
                </p>
                <ol className="mt-6 space-y-5">
                  {SCALE_STEPS.map((step, i) => (
                    <li key={step} className="flex items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-base font-bold text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 text-sm text-muted">
                  Every new LGU is minutes of setup, not months of building — so this can
                  reach the whole country, one office at a time.
                </p>
              </div>

              <div className="md:pl-10">
                <p className="text-[13px] font-bold uppercase tracking-wide text-brand">
                  What we’re not claiming
                </p>
                <ul className="mt-6 space-y-4">
                  {LIMITS.map((l) => (
                    <li key={l.title} className="text-sm text-muted">
                      <span className="font-bold text-foreground">{l.title}</span> — {l.body}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================== THE BIG PICTURE */}
      {/* Woven tinagu bands mirrored to the right — the source art's empty white
          half then falls on the left, leaving a clean canvas for the quote. Bands
          are desktop-only; on mobile the quote sits on plain white so the pattern
          never fights the text. */}
      <section className="relative isolate overflow-hidden border-y border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/Social Card Background.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden h-full w-full -scale-x-100 object-cover object-left opacity-80 md:block"
        />
        {/* Fade to solid white just past the bands so the quote always reads,
            while keeping the full pattern (incl. the people column) visible. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              'linear-gradient(to left, transparent 0%, transparent 50%, rgba(255,255,255,0.85) 58%, #fff 64%)',
          }}
        />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1fr_1.4fr] md:py-24">
          <div className="text-center md:text-left">
            <blockquote className="font-display text-2xl leading-relaxed text-foreground md:text-3xl">
              “It looks like a small thing — a simple tool for local offices. Multiply it
              across every barangay, and it gives millions of Filipinos their time back.”
            </blockquote>
            <p className="mt-5 text-sm font-bold text-brand">Why eSee LGU matters</p>
          </div>
          <div aria-hidden className="hidden md:block" />
        </div>
      </section>

      {/* ===================================================== GET STARTED */}
      {/* White dotted-grid backdrop with faint Royal Blue dots — the closing CTA
          echoes the solution section's motif, inverted for a light surface. */}
      <section
        style={{
          backgroundColor: '#FFFFFF',
          backgroundImage: 'radial-gradient(rgba(0,50,160,.13) 1px, transparent 1px)',
          backgroundSize: '15px 15px',
        }}
      >
        <Section>
          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <h2 className="font-display text-3xl leading-tight text-foreground md:text-[40px]">
                Get started
              </h2>
              <div className="space-y-3">
                {getStarted.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex items-center gap-4 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-brand-soft"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                      →
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-foreground">{item.title}</span>
                      <span className="block text-sm text-muted">{item.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface p-8">
              <Eyebrow>Onboard your LGU</Eyebrow>
              <h3 className="mt-2 font-display text-2xl text-foreground">Bring your barangay online</h3>
              <p className="mt-2 text-sm text-muted">
                {liveSso
                  ? 'LGU onboarding starts from eGovPH after DICT assigns your role.'
                  : 'Sign in with your eGovPH account — your role is assigned by DICT.'}
              </p>
              {!liveSso ? (
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
                  <ButtonLink href={OFFICER_SIGNIN} className="h-11 w-full text-base">
                    Request onboarding
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      </section>

      {/* ========================================================== FOOTER */}
      <footer className="bg-surface-footer">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-3">
            <p className="font-display text-xl text-white">eSee LGU</p>
            <p className="text-sm text-white/60">
              Putting local government services online — so no Filipino has to lose a day
              in line for a single document. Backed by DICT review on every service.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={liveSso
              ? [['Browse services', '/citizen/services'], ['Verify a document', '/verify']]
              : [['Officer console', OFFICER_SIGNIN], ['Browse services', '/citizen/services'], ['Verify a document', '/verify']]}
          />
          <FooterCol
            title="Learn more"
            links={liveSso
              ? [['Implementation', '/implementation']]
              : [['Implementation', '/implementation'], ['DICT review', '/review'], ['Sign in', SIGNIN]]}
          />
          <div className="space-y-3">
            <p className="text-sm font-bold text-white">Stay informed</p>
            <div className="flex overflow-hidden rounded-sm border border-white/25">
              <span className="flex-1 px-3 py-2 text-sm text-white/50">Email goes here</span>
              <span className="bg-accent px-4 py-2 text-sm font-bold text-black">Send</span>
            </div>
            <p className="text-xs text-white/50">Team PRODIGITALITY · built on eGovPH</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-white">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-white/60 hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
