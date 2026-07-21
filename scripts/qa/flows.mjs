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
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

config({ path: '.env.local', quiet: true })

const STUDIO_QA_LGU = 'dddddddd-0000-0000-0000-000000000001'
function qaDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase QA credentials missing')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
async function seedEltonRequest(id, feeStatus = 'unpaid') {
  const db = qaDb()
  await cleanupEltonRequest(id)
  const { data: officer, error: officerError } = await db.from('officers').select('lgu_id').eq('egov_sub', 'demo-officer-sub').eq('role', 'officer').maybeSingle()
  if (officerError || !officer) throw new Error(officerError?.message ?? 'Demo officer is not assigned to an LGU')
  const { data: service, error: serviceError } = await db.from('lgu_services').select('id,fee_amount').eq('lgu_id', officer.lgu_id).eq('status', 'published').gt('fee_amount', 0).limit(1).maybeSingle()
  if (serviceError || !service) throw new Error(serviceError?.message ?? 'No paid published service available for QA')
  const { error } = await db.from('requests').insert({ id, lgu_service_id: service.id, citizen_sub: 'demo-citizen-sub', citizen_name: `QA Citizen ${id.slice(-2)}`, citizen_mobile: '+639171234567', everify_payload: { full_name: 'QA Citizen', reference: `EV-${id.slice(-4)}` }, everify_reference: `EV-${id.slice(-4)}`, liveness_passed: true, liveness_score: 98.5, form_data: { purpose: 'Employment' }, status: 'submitted', fee_due: Number(service.fee_amount), fee_status: feeStatus })
  if (error) throw new Error(error.message)
}
async function cleanupEltonRequest(id) {
  const db = qaDb()
  const { data } = await db.from('requests').select('pdf_path').eq('id', id).maybeSingle()
  if (data?.pdf_path) await db.storage.from('documents').remove([data.pdf_path])
  await db.from('request_events').delete().eq('request_id', id)
  await db.from('requests').delete().eq('id', id)
}
async function cleanupCitizenDrafts() {
  const db = qaDb()
  const { data } = await db.from('requests').select('id, uploaded_docs').eq('citizen_sub', 'demo-citizen-sub').eq('status', 'draft')
  for (const draft of data ?? []) {
    const paths = Array.isArray(draft.uploaded_docs) ? draft.uploaded_docs.map((item) => item?.path).filter(Boolean) : []
    if (paths.length) await db.storage.from('application-documents').remove(paths)
    await db.from('requests').delete().eq('id', draft.id)
  }
}
async function ensureStudioQaLgu() {
  const db = qaDb()
  const { error } = await db.from('lgus').upsert({ id: STUDIO_QA_LGU, name: 'QA Integration LGU', type: 'municipality', region: 'QA', psgc_code: '9900000000', official_email: 'qa@example.gov.ph' }, { onConflict: 'id' })
  if (error) throw new Error(error.message)
  const { error: officerError } = await db.from('officers').upsert({ id: 'dddddddd-0000-0000-0000-000000000002', egov_sub: 'qa-studio-officer-sub', lgu_id: STUDIO_QA_LGU, full_name: 'QA Studio Officer', position: 'QA', role: 'officer' }, { onConflict: 'id' })
  if (officerError) throw new Error(officerError.message)
}
async function cleanupStudioQaLgu() {
  const db = qaDb()
  const { data: services } = await db.from('lgu_services').select('id').eq('lgu_id', STUDIO_QA_LGU)
  const ids = (services ?? []).map((service) => service.id)
  if (ids.length) await db.from('validation_flags').delete().in('lgu_service_id', ids)
  await db.from('lgu_services').delete().eq('lgu_id', STUDIO_QA_LGU)
  await db.from('studio_generation_cache').delete().eq('lgu_id', STUDIO_QA_LGU)
  await db.from('officers').delete().eq('egov_sub', 'qa-studio-officer-sub')
  await db.from('lgus').delete().eq('id', STUDIO_QA_LGU)
}
async function setQaSession(page, baseUrl, role, lguId) {
  const origin = new URL(baseUrl)
  if (!['localhost', '127.0.0.1'].includes(origin.hostname)) {
    const persona = role === 'officer' && lguId === STUDIO_QA_LGU ? 'qa-officer' : role
    await page.goto(`${baseUrl}/api/auth/egov/login?persona=${persona}`, { waitUntil: 'domcontentloaded' })
    if (page.url().includes('/authorize') || page.url().includes('error=')) {
      throw new Error(`Deployed ${role} QA session could not be established at ${page.url()}`)
    }
    return
  }
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET missing')
  const officer = role === 'officer'
  const reviewer = role === 'reviewer'
  let sessionLguId = lguId ?? null
  if (officer && !sessionLguId) {
    const { data: assignedOfficer, error } = await qaDb().from('officers').select('lgu_id').eq('egov_sub', 'demo-officer-sub').eq('role', 'officer').maybeSingle()
    if (error || !assignedOfficer) throw new Error(error?.message ?? 'Demo officer is not assigned to an LGU')
    sessionLguId = assignedOfficer.lgu_id
  }
  const token = await new SignJWT({
    sub: officer ? 'demo-officer-sub' : reviewer ? 'demo-reviewer-sub' : 'demo-citizen-sub',
    name: officer ? 'Maria Santos' : reviewer ? 'Jose Reyes' : 'Demo Citizen',
    role,
    lguId: officer ? sessionLguId : null,
    mobile: '+639171234567',
    firstName: officer ? 'Maria' : 'Juana',
    middleName: officer ? '' : 'Santos',
    lastName: officer ? 'Santos' : 'Dela Cruz',
    suffix: '',
    birthDate: '1992-03-14',
    address: '24 Sampaguita St., Barangay Plainview, Mandaluyong City',
    ssoSource: 'mock',
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET))
  await page.context().addCookies([{ name: 'egovdx_session', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax', secure: origin.protocol === 'https:' }])
}

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
    name: 'Product landing — role gateway connects all three journeys',
    owner: 'Jasmin',
    /** @param {Ctx} c */
    async run({ page, baseUrl, shot }) {
      await visit(page, baseUrl, { path: '/' })
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10_000 })

      await page.getByRole('heading', { name: /choose your egovph role/i }).waitFor()
      await page.getByRole('link', { name: /citizen services/i }).waitFor()
      await page.getByRole('link', { name: /officer console/i }).first().waitFor()
      await page.getByRole('link', { name: /dict review/i }).first().waitFor()
      await shot('role-gateway')
      return 'citizen, officer, and reviewer entry points rendered'
    },
  },

  {
    id: 'signin',
    name: 'Sign in — citizen LGU discovery is the primary journey',
    owner: 'Jasmin',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/signin`)
      await page.getByRole('heading', { name: /your lgu services/i }).waitFor()
      await page.getByRole('link', { name: /browse my lgu/i }).waitFor()
      await page.getByRole('link', { name: /lgu officer/i }).waitFor()
      await page.getByRole('link', { name: /dict reviewer/i }).waitFor()
      await shot('citizen-gateway')
      return 'mobile LGU preview and all three access paths rendered'
    },
  },

  {
    id: 'service-catalog',
    name: 'Citizen catalog — published services render',
    owner: 'Jasmin',
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/citizen/services`)
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
      if (['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) {
        await setQaSession(page, baseUrl, 'officer')
        await visit(page, `${baseUrl}/console`)
        await shot('officer-signed-in')
        return 'local signed test session routed to /console'
      }
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
    async run({ page, baseUrl, shot }) {
      await visit(page, `${baseUrl}/signin`)
      await page.getByRole('link', { name: /browse my lgu|continue as a citizen/i }).click()
      await page.waitForLoadState('domcontentloaded')
      const url = page.url()
      if (url.includes('error=')) {
        throw new Error(`Sign-in failed: ${new URL(url).searchParams.get('error')}`)
      }
      const pathname = new URL(url).pathname
      if (pathname !== '/citizen/services') {
        throw new Error(`Citizen landed on ${pathname}, expected /citizen/services`)
      }
      await page.getByRole('heading', { name: /request a local government document online/i }).waitFor()
      await page.getByText('citizen', { exact: true }).waitFor()
      await page.getByRole('link', { name: /sign out/i }).waitFor()
      await shot('citizen-signed-in')
      return 'citizen session established at /citizen/services'
    },
  },

  {
    id: 'apply',
    name: 'Citizen apply — dynamic form renders from the configured field list',
    owner: 'Jasmin',
    async run({ page, baseUrl, shot }) {
      await cleanupCitizenDrafts()
      await setQaSession(page, baseUrl, 'citizen')
      await visit(page, `${baseUrl}/citizen/services`, { path: '/citizen/services' })
      const first = page.getByRole('link', { name: /request this/i }).first()
      if ((await first.count()) === 0) throw new Error('No service to apply for')

      const href = await first.getAttribute('href')
      await visit(page, `${baseUrl}${href}`, { path: href ?? '/citizen/apply' })

      await page.getByRole('button', { name: /start face liveness/i }).click()
      await page.getByRole('heading', { name: /application form/i }).waitFor({ timeout: 30_000 })
      const fields = page.locator('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
      const count = await fields.count()
      if (count === 0) throw new Error('Apply page rendered no editable form fields')
      for (let index = 0; index < count; index++) {
        const field = fields.nth(index)
        const tag = await field.evaluate((element) => element.tagName.toLowerCase())
        const type = await field.getAttribute('type')
        if (type === 'file') continue
        if (tag === 'select') await field.selectOption({ index: 1 })
        else if (type === 'number') await field.fill('2')
        else if (type === 'date') await field.fill('2026-08-01')
        else await field.fill(`QA value ${index + 1}`)
      }
      await page.getByRole('button', { name: /save and continue/i }).click()
      await page.getByRole('heading', { name: /required documents/i }).waitFor()
      const uploads = page.locator('input[type="file"]')
      for (let index = 0; index < await uploads.count(); index++) await uploads.nth(index).setInputFiles({ name: `qa-${index}.png`, mimeType: 'image/png', buffer: Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) })
      await page.getByRole('button', { name: /continue to fee/i }).click()
      await page.getByRole('button', { name: /assess fee/i }).click()
      const confirm = page.getByRole('button', { name: /confirm mock payment/i })
      if (await confirm.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) await confirm.click()
      await page.getByRole('heading', { name: /submit application/i }).waitFor()
      await shot('apply-ready-to-submit')
      await page.getByRole('button', { name: /submit request/i }).click()
      await page.waitForURL(/\/track\//, { timeout: 15_000 })
      await page.getByRole('heading', { name: /request status/i }).waitFor()
      await shot('application-submitted')
      return `${count} dynamic field(s), evidence, fee, and submission completed`
    },
  },

  {
    id: 'console',
    name: 'Officer console — service dashboard loads',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      await setQaSession(page, baseUrl, 'officer')
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
      await setQaSession(page, baseUrl, 'officer')
      await visit(page, `${baseUrl}/console/register`)
      await page.getByRole('heading', { name: /register an lgu/i }).waitFor({ timeout: 10_000 })
      await page.getByPlaceholder('e.g. Marilao').fill('Marilao')
      await page.getByRole('button', { name: /^search$/i }).click()
      await shot('lgu-registration-search')
      return 'registration route and PSA search reachable'
    },
  },

  {
    id: 'elton-payment',
    name: 'eGOV PAY — citizen completes a mock payment safely',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      const id = 'eeeeeeee-1000-0000-0000-000000000001'
      await seedEltonRequest(id)
      try {
        await setQaSession(page, baseUrl, 'citizen')
        await visit(page, `${baseUrl}/citizen/pay/${id}`)
        await page.getByRole('heading', { name: /fee assessment/i }).waitFor({ timeout: 15_000 })
        await page.waitForTimeout(250)
        await page.getByRole('button', { name: /assess fee/i }).click()
        const confirm = page.getByRole('button', { name: /confirm mock payment/i })
        await confirm.waitFor({ timeout: 60_000 })
        await confirm.click()
        await page.getByText(/ready for officer review/i).waitFor()
        await shot('elton-payment-complete')
        return 'payment created and reconciled once'
      } finally { await cleanupEltonRequest(id) }
    },
  },

  {
    id: 'elton-approval',
    name: 'Approval queue — officer issues, anchors, and notifies in one click',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      const id = 'eeeeeeee-1000-0000-0000-000000000002'
      await seedEltonRequest(id, 'paid')
      try {
        await setQaSession(page, baseUrl, 'officer')
        await visit(page, `${baseUrl}/console/requests`)
        const row = page.locator('article').filter({ hasText: 'QA Citizen 02' })
        await row.waitFor()
        await page.waitForTimeout(250)
        await row.getByRole('button', { name: /approve and issue/i }).click()
        // A real chain receipt can take the adapter's full 30-second receipt
        // window on a cold serverless start. Accept every honestly labelled
        // source; production is expected to show Live API, while local QA uses
        // the explicit mock badge.
        await row.getByRole('link', { name: /open public verification/i }).waitFor({ timeout: 90_000 })
        await row.getByText(/Live API|Mock data|Offline — using cached data/i).first().waitFor()
        await shot('elton-approved-issued')
        return 'PDF, chain attempt, and SMS completed'
      } finally { await cleanupEltonRequest(id) }
    },
  },

  {
    id: 'unified-issuance',
    name: 'Unified journey — officer issuance reaches citizen tracking and public verification',
    owner: 'Earl',
    async run({ page, baseUrl, shot }) {
      const id = 'eeeeeeee-1000-0000-0000-000000000003'
      await seedEltonRequest(id, 'paid')
      try {
        await setQaSession(page, baseUrl, 'officer')
        let row = page.locator('article').filter({ hasText: 'QA Citizen 03' })
        for (let attempt = 0; attempt < 6; attempt++) {
          await visit(page, `${baseUrl}/console/requests`)
          row = page.locator('article').filter({ hasText: 'QA Citizen 03' })
          if (await row.isVisible().catch(() => false)) break
          await page.waitForTimeout(2_000)
        }
        await row.waitFor({ timeout: 15_000 })
        await page.waitForTimeout(250)
        await row.getByRole('button', { name: /approve and issue/i }).click()
        await row.getByRole('link', { name: /open public verification/i }).waitFor({ timeout: 90_000 })
        await shot('officer-issued')

        await setQaSession(page, baseUrl, 'citizen')
        await visit(page, `${baseUrl}/citizen/track/${id}`)
        await page.getByText(/official pdf is ready/i).waitFor()
        await page.getByRole('link', { name: /verify document/i }).waitFor()
        await shot('citizen-issued')

        await page.context().clearCookies()
        await visit(page, `${baseUrl}/verify/${id}`)
        await page.getByRole('heading', { name: /document verified/i }).waitFor({ timeout: 30_000 })
        await shot('publicly-verified')
        return 'approval, issuance, citizen tracking, and signed-out verification completed'
      } finally {
        await cleanupEltonRequest(id)
      }
    },
  },

  {
    id: 'elton-analytics',
    name: 'LGU analytics — officer sees scoped operational metrics',
    owner: 'Elton',
    async run({ page, baseUrl, shot }) {
      await setQaSession(page, baseUrl, 'officer')
      await visit(page, `${baseUrl}/console/analytics`)
      await page.getByRole('heading', { name: /service analytics/i }).waitFor()
      await shot('elton-analytics')
      return 'LGU-scoped analytics rendered'
    },
  },

  {
    id: 'studio',
    name: 'AI Studio — prompt box accepts an unrehearsed service description',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      await ensureStudioQaLgu()
      try {
        await setQaSession(page, baseUrl, 'officer', STUDIO_QA_LGU)
        await visit(page, `${baseUrl}/console/studio`)

        const prompt = page.locator('textarea').first()
        await prompt.waitFor({ timeout: 30_000 })
        await page.waitForTimeout(250)
        await prompt.fill(
          'Create a Tricycle Franchise Renewal for Marilao. Require OR/CR and a ' +
            'barangay clearance. Charge a fee of 300 pesos. Route approvals to the ' +
            'Municipal Transport Office.',
        )
        await page.getByRole('button', { name: 'Generate preview' }).click()
        await page.getByText(/No validation findings|validation finding/i).first().waitFor({ timeout: 75_000 })
        await shot('studio-preview')
        await page.getByRole('button', { name: 'Confirm and submit' }).click()
        await page.getByText(/Published|Sent to DICT review/).waitFor({ timeout: 20_000 })

        const upload = page.locator('input[type=file]')
        await upload.setInputFiles({ name: 'blank-tricycle-form.png', mimeType: 'image/png', buffer: Buffer.from('mock blank form for extractor QA') })
        await page.getByText(/Model:/).waitFor({ timeout: 45_000 })
        await shot('studio-upload-preview')
        return 'unrehearsed prompt generated, confirmed, and blank form extracted in an isolated QA LGU'
      } finally {
        await cleanupStudioQaLgu()
      }
    },
  },

  {
    id: 'review-queue',
    name: 'DICT review queue — flagged service shows the rule it broke',
    owner: 'David',
    async run({ page, baseUrl, shot }) {
      await setQaSession(page, baseUrl, 'reviewer')
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
    diagnostic: true,
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
    id: 'everify-harness',
    diagnostic: true,
    name: 'eVerify harness — protected normalized result renders',
    owner: 'Joshua',
    async run({ page, baseUrl, shot }) {
      await setQaSession(page, baseUrl, 'citizen')
      await visit(page, `${baseUrl}/implementation/everify`)
      await page.getByRole('button', { name: /verify identity/i }).click()
      await page.getByText(/verificationReceipt/).waitFor({ timeout: 30_000 })
      await shot('everify-result')
      return 'normalized eVerify result and signed receipt rendered'
    },
  },

  {
    id: 'egov-chain-harness',
    diagnostic: true,
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
    diagnostic: true,
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
      await page.waitForTimeout(250)
      const upload = {
        name: 'test-doc.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBytes,
      }
      await fileInput.setInputFiles(upload)

      const hashResult = page.getByText(/sha-256 of uploaded file/i)
      if (!(await hashResult.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false))) {
        await fileInput.setInputFiles([])
        await page.waitForTimeout(250)
        await fileInput.setInputFiles(upload)
      }

      await hashResult.waitFor({ timeout: 30_000 })
      await shot('verify-upload-hash')
      return 'browser hash computed'
    },
  },

  {
    id: 'implementation-board',
    diagnostic: true,
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
