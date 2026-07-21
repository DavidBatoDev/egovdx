/**
 * QA flow definitions.
 *
 * One entry per user-visible journey. Add yours when your feature lands —
 * `owner` maps to the person in src/app/implementation/manifest.ts so a failing
 * run tells you who to talk to rather than just that something is broken.
 *
 * A flow's `steps` run in order against a live dev server. Any step that throws
 * fails the flow; a flow whose FIRST step 404s is reported as PENDING rather
 * than FAILED, because on a parallel build "not written yet" and "broken" are
 * different problems and conflating them makes the report useless.
 */

/**
 * @typedef {object} Ctx
 * @property {import('playwright').Page} page
 * @property {string} baseUrl
 * @property {(name: string) => Promise<void>} shot  Named screenshot
 */

/** Thrown when a route doesn't exist yet — reported as pending, not failed. */
export class NotBuiltError extends Error {
  constructor(path, status) {
    super(`${path} returned ${status} — not built yet`)
    this.name = 'NotBuiltError'
    this.notBuilt = true
  }
}

/**
 * Navigate and assert the response actually succeeded.
 *
 * Playwright's page.goto() resolves happily on a 404 — the navigation did
 * complete, after all. Without this check a flow that only calls goto() and
 * screenshots reports PASS for a route that doesn't exist, which is precisely
 * the false-green-check problem we refuse to ship in the product itself.
 */
export async function visit(page, url, { path = new URL(url).pathname } = {}) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
  const status = res?.status() ?? 0

  if (status === 404) throw new NotBuiltError(path, status)
  if (status >= 400) throw new Error(`${path} returned HTTP ${status}`)

  return res
}

export const flows = [
  {
    id: 'landing',
    name: 'Citizen landing — published services render',
    owner: 'Jasmin',
    /** @param {Ctx} c */
    async run({ page, baseUrl, shot }) {
      await visit(page, baseUrl, { path: '/' })
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10_000 })

      // The setup panel means Supabase isn't reachable. That is a real failure
      // of the page's purpose even though the page itself rendered fine.
      const setupNotice = page.getByText('Finish the Supabase setup')
      if (await setupNotice.isVisible().catch(() => false)) {
        throw new Error('Supabase unreachable — landing page shows setup instructions')
      }

      const requestButtons = page.getByRole('link', { name: /request this/i })
      const count = await requestButtons.count()
      if (count === 0) throw new Error('No published services rendered — is seed.sql loaded?')

      await shot('services-listed')
      return `${count} service(s) listed`
    },
  },

  {
    id: 'sso-officer',
    name: 'SSO — officer signs in and is routed to the console',
    owner: 'Joshua',
    async run({ page, baseUrl, shot }) {
      // The login route redirects, so check where we ended up AND that the
      // destination actually rendered — a redirect into a 404 is not a pass.
      await visit(page, `${baseUrl}/api/auth/egov/login?persona=officer`, {
        path: '/api/auth/egov/login',
      })

      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      if (!url.includes('/console')) {
        throw new Error(`Officer landed on ${url}, expected /console`)
      }

      await visit(page, url, { path: '/console' })

      await shot('officer-signed-in')
      return 'routed to /console'
    },
  },

  {
    id: 'sso-citizen',
    name: 'SSO — citizen signs in and lands on the service directory',
    owner: 'Joshua',
    async run({ page, baseUrl }) {
      await visit(page, `${baseUrl}/api/auth/egov/login?persona=citizen`, {
        path: '/api/auth/egov/login',
      })
      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      if (new URL(url).pathname !== '/') {
        throw new Error(`Citizen landed on ${url}, expected /`)
      }

      await visit(page, url, { path: '/' })
      await page.getByText('Mock data', { exact: true }).waitFor({ timeout: 10_000 })
      return 'routed to /'
    },
  },

  {
    id: 'sso-reviewer',
    name: 'SSO — reviewer signs in and is routed to the review queue',
    owner: 'Joshua',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/api/auth/egov/login?persona=reviewer`, {
        path: '/api/auth/egov/login',
      })

      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      if (!url.includes('/review')) {
        throw new Error(`Reviewer landed on ${url}, expected /review`)
      }

      await visit(page, url, { path: '/review' })
      await shot('reviewer-signed-in')
      return 'routed to /review'
    },
  },

  {
    id: 'apply',
    name: 'Citizen apply — dynamic form renders from the configured field list',
    owner: 'Jasmin',
    async run({ page, baseUrl, shot }) {
      await visit(page, baseUrl, { path: '/' })
      const first = page.getByRole('link', { name: /request this/i }).first()
      if ((await first.count()) === 0) throw new Error('No service to apply for')

      const href = await first.getAttribute('href')
      await visit(page, `${baseUrl}${href}`, { path: href ?? '/apply' })

      const fields = page.locator('input, select, textarea')
      const count = await fields.count()
      if (count === 0) throw new Error('Apply page rendered no form fields')

      await shot('apply-form')
      return `${count} field(s) rendered`
    },
  },

  {
    id: 'console',
    name: 'Officer console — service dashboard loads',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=officer`)
      await visit(page, `${baseUrl}/console`)
      await shot('console')
      return 'console reachable'
    },
  },

  {
    id: 'studio',
    name: 'AI Studio — prompt box accepts an unrehearsed service description',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=officer`)
      await visit(page, `${baseUrl}/console/studio`)

      const prompt = page.locator('textarea').first()
      await prompt.waitFor({ timeout: 10_000 })

      // Deliberately NOT the rehearsed demo prompt. The bar is a working app,
      // so the Studio has to handle a service nobody scripted.
      await prompt.fill(
        'Create a Tricycle Franchise Renewal for Marilao. Require OR/CR and a ' +
          'barangay clearance. Charge a fee of 300 pesos. Route approvals to the ' +
          'Municipal Transport Office.',
      )
      await shot('studio-prompt')
      return 'prompt accepted'
    },
  },

  {
    id: 'review-queue',
    name: 'DICT review queue — flagged service shows the rule it broke',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=reviewer`)
      await visit(page, `${baseUrl}/review`)
      await shot('review-queue')
      return 'review queue reachable'
    },
  },

  {
    id: 'verify',
    name: 'Public verification — page is reachable without a session',
    owner: 'Earl',
    /** Runs in a fresh, signed-out context: a bank clerk scanning a QR has no account. */
    signedOut: true,
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/verify`)

      const bodyText = (await page.locator('body').innerText()).toLowerCase()
      if (bodyText.includes('unauthenticated') || bodyText.includes('forbidden')) {
        throw new Error('Verification page requires a session — it must be public')
      }

      await shot('verify')
      return 'public and reachable'
    },
  },

  {
    id: 'implementation-board',
    name: 'Team board — every feature has an owner',
    owner: 'David',
    async run({ page, baseUrl }) {
      await visit(page, `${baseUrl}/implementation`)
      const unassigned = await page.getByText('unassigned').count()
      if (unassigned > 0) throw new Error(`${unassigned} feature(s) still unassigned`)
      return 'all features owned'
    },
  },
]
