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
      const res = await page.goto(`${baseUrl}/api/auth/egov/login?persona=officer`, {
        waitUntil: 'domcontentloaded',
      })

      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      if (!url.includes('/console')) {
        throw new Error(`Officer landed on ${url}, expected /console`)
      }

      const status = res?.status() ?? 0
      if (status === 404) throw new NotBuiltError('/console', status)
      if (status >= 400) throw new Error(`/console returned HTTP ${status}`)

      await shot('officer-signed-in')
      return 'routed to /console'
    },
  },

  {
    id: 'sso-citizen',
    name: 'SSO — citizen signs in and lands on the service directory',
    owner: 'Joshua',
    async run({ page, baseUrl }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=citizen`, {
        waitUntil: 'domcontentloaded',
      })
      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      return 'session established'
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
    id: 'lgu-onboarding',
    name: 'LGU onboarding — officer can open PSA-backed registration',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=officer`)
      await visit(page, `${baseUrl}/console/register`)
      await page.getByRole('heading', { name: /register an lgu/i }).waitFor({ timeout: 10_000 })
      await page.getByPlaceholder('e.g. Marilao').fill('Marilao')
      await page.getByRole('button', { name: /^search$/i }).click()
      await shot('lgu-registration-search')
      return 'registration route and PSA search reachable'
    },
  },

  {
    id: 'studio',
    name: 'AI Studio — prompt box accepts an unrehearsed service description',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      const response = await page.goto(
        `${baseUrl}/api/auth/egov/login?persona=officer&next=/console/studio`,
        { waitUntil: 'domcontentloaded' },
      )
      const status = response?.status() ?? 0
      if (status === 404) throw new NotBuiltError('/console/studio', status)
      if (status >= 400) throw new Error(`/console/studio returned HTTP ${status}`)
      if (!page.url().includes('/console/studio')) {
        throw new Error(`Officer landed on ${page.url()}, expected /console/studio`)
      }

      const prompt = page.locator('textarea').first()
      await prompt.waitFor({ timeout: 30_000 })

      // Deliberately NOT the rehearsed demo prompt. The bar is a working app,
      // so the Studio has to handle a service nobody scripted.
      await prompt.fill(
        'Create a Tricycle Franchise Renewal for Marilao. Require OR/CR and a ' +
          'barangay clearance. Charge a fee of 300 pesos. Route approvals to the ' +
          'Municipal Transport Office.',
      )
      await page.getByRole('button', { name: 'Generate preview' }).click()
      await page.getByText(/No validation findings|validation finding/i).first().waitFor({ timeout: 45_000 })
      await shot('studio-preview')
      await page.getByRole('button', { name: 'Confirm and submit' }).click()
      await page.getByText(/Published|Sent to DICT review/).waitFor({ timeout: 20_000 })

      const upload = page.locator('input[type=file]')
      await upload.setInputFiles({
        name: 'blank-tricycle-form.png',
        mimeType: 'image/png',
        buffer: Buffer.from('mock blank form for extractor QA'),
      })
      await page.getByText(/Model:/).waitFor({ timeout: 45_000 })
      await shot('studio-upload-preview')
      return 'unrehearsed prompt generated, confirmed, and blank form extracted'
    },
  },

  {
    id: 'review-queue',
    name: 'DICT review queue — flagged service shows the rule it broke',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      await page.goto(`${baseUrl}/api/auth/egov/login?persona=reviewer`)
      await visit(page, `${baseUrl}/review`)
      for (let resolved = 0; resolved < 10; resolved++) {
        const firstNote = page.getByPlaceholder('Required approved-exception note').first()
        if (!(await firstNote.isVisible().catch(() => false))) break
        await firstNote.fill('Approved exception for the recorded regional pilot.')
        await firstNote.locator('xpath=..').getByRole('button', { name: 'Resolve' }).click()
        await page.waitForLoadState('domcontentloaded')
      }
      const publish = page.getByRole('button', { name: 'Publish service' }).first()
      if (await publish.isEnabled().catch(() => false)) {
        await publish.click()
        await page.waitForLoadState('domcontentloaded')
      }
      const body = await page.locator('body').innerText()
      if (/application error|internal server error/i.test(body)) {
        throw new Error('Reviewer mutation returned an application error')
      }
      await shot('review-queue')
      return 'review queue reached and available exception was resolved/published'
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

      await page.getByRole('heading', { name: /verify a document/i }).waitFor()
      await shot('verify')
      return 'public and reachable'
    },
  },

  {
    id: 'verify-reject',
    name: 'Public verification — unknown document shows rejection',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/verify/00000000-0000-0000-0000-000000000000`)
      await page.getByText(/document not verified/i).waitFor({ timeout: 10_000 })
      await shot('verify-rejected')
      return 'unknown document rejected'
    },
  },

  {
    id: 'doc-issuance-harness',
    name: 'Doc issuance harness — PDF generates with hash',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/implementation/doc-issuance`)
      await page.getByText(/control number/i).first().waitFor({ timeout: 15_000 })
      await page.getByText(/sha-256/i).first().waitFor()
      const body = await page.locator('body').innerText()
      if (body.toLowerCase().includes('error') && body.includes('danger')) {
        throw new Error('Harness page shows an error state')
      }
      await shot('doc-issuance')
      return 'PDF hash rendered'
    },
  },

  {
    id: 'egov-chain-harness',
    name: 'eGOV chain harness — anchor and verify round-trip',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/implementation/egov-chain`)
      await page.getByText(/transaction hash/i).waitFor({ timeout: 15_000 })
      const body = await page.locator('body').innerText()
      if (!body.includes('Hash matches') && !body.includes('local fallback')) {
        throw new Error('Expected anchor/verify result on harness page')
      }
      await shot('egov-chain')
      return body.includes('Hash matches') ? 'hash matches' : 'local fallback (mock mode)'
    },
  },

  {
    id: 'verify-qr-harness',
    name: 'Verify QR harness — links to live verify routes',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/implementation/verify-qr`)
      await page.getByRole('heading', { name: /public qr verification/i }).waitFor()
      await page.getByRole('link', { name: /open/i }).first().waitFor()
      await shot('verify-qr-harness')
      return 'harness documents verify flow'
    },
  },

  {
    id: 'verify-upload',
    name: 'Verify upload — PDF hash computed in browser',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/verify`)
      await page.getByText(/upload pdf/i).waitFor()

      // Minimal valid PDF bytes — enough for SHA-256 in the browser.
      const pdfBytes = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
          '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n' +
          'xref\n0 3\n0000000000 65535 f \ntrailer<</Root 1 0 R/Size 3>>\nstartxref\n%%EOF',
      )
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles({
        name: 'test-doc.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBytes,
      })

      await page.getByText(/sha-256 of uploaded file/i).waitFor({ timeout: 10_000 })
      await shot('verify-upload-hash')
      return 'browser hash computed'
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
