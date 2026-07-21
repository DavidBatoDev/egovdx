/**
 * Earl — unit + API integration tests.
 *
 *   npm run test:earl
 *
 * Requires the dev server on QA_BASE_URL (default http://localhost:3000).
 * Loads credentials from .env.local via dotenv.
 */

import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { strict as assert } from 'node:assert'
import { SignJWT } from 'jose'
import { controlNumber, shortHash } from '../../src/lib/format'

config({ path: '.env.local' })

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000'

type Result = { name: string; ok: boolean; error?: string; ms: number }

const results: Result[] = []
let officerCookie = ''

async function test(name: string, fn: () => Promise<void> | void) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - started })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    results.push({ name, ok: false, error, ms: Date.now() - started })
    console.log(`  ✗ ${name}`)
    console.log(`    ${error}`)
  }
}

async function jsonPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: officerCookie },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing in .env.local')
  return createClient(url, key, { auth: { persistSession: false } })
}

const TEST_REQUEST_ID = 'dddddddd-0000-0000-0000-000000000099'

async function ensureDocumentsBucket() {
  const db = supabase()
  const { error } = await db.storage.createBucket('documents', { public: false })
  // Ignore "already exists" — bucket may have been created in a prior run.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.warn(`  ⚠ documents bucket: ${error.message}`)
  }
}

async function seedApprovedRequest() {
  await ensureDocumentsBucket()
  const db = supabase()
  await db.storage.from('documents').remove([`${TEST_REQUEST_ID}.pdf`])
  await db.from('request_events').delete().eq('request_id', TEST_REQUEST_ID)
  await db.from('requests').delete().eq('id', TEST_REQUEST_ID)
  const { data: service, error: serviceError } = await db.from('lgu_services').select('id').eq('lgu_id', '22222222-2222-2222-2222-222222222222').eq('status', 'published').gt('fee_amount', 0).limit(1).maybeSingle()
  if (serviceError || !service) throw new Error(serviceError?.message ?? 'No paid published service available')
  const { error } = await db.from('requests').insert({
    id: TEST_REQUEST_ID,
    lgu_service_id: service.id,
    citizen_name: 'JOSIE DELA CRUZ',
    citizen_mobile: '+639090000000',
    everify_payload: {
      full_name: 'JOSIE SANTOS DELA CRUZ',
      birth_date: '1990-01-01',
      full_address: '123 Rizal St., Poblacion, City of Alaminos, Pangasinan',
      reference: 'EV-TEST-001',
    },
    liveness_passed: true,
    liveness_score: 98.5,
    form_data: { purpose: 'Employment', years_of_residency: '5' },
    status: 'approved',
    fee_due: 50,
    fee_status: 'paid',
  })
  if (error) throw new Error(`seed request: ${error.message}`)
}

async function cleanupTestRequest() {
  const db = supabase()
  const { data: request } = await db.from('requests').select('pdf_path').eq('id', TEST_REQUEST_ID).maybeSingle()
  if (request?.pdf_path) await db.storage.from('documents').remove([request.pdf_path])
  await db.from('request_events').delete().eq('request_id', TEST_REQUEST_ID)
  await db.from('requests').delete().eq('id', TEST_REQUEST_ID)
}

async function main() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET missing')
  const token = await new SignJWT({ sub: 'demo-officer-sub', name: 'Maria Santos', role: 'officer', lguId: '22222222-2222-2222-2222-222222222222', mobile: '+639171234567' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret))
  officerCookie = `egovdx_session=${token}`
  console.log(`\nEarl tests — ${BASE}\n`)

  // ── unit: format helpers ──────────────────────────────────────────────────
  console.log('Unit — format.ts')
  await test('controlNumber produces BRGY-YYYY-NNNNNN shape', () => {
    const cn = controlNumber('BRGY_CLEARANCE', 1)
    assert.match(cn, /^BRGY-\d{4}-\d{6}$/)
  })
  await test('controlNumber prefixes from template code', () => {
    const cn = controlNumber('INDIGENCY_CERT', 42)
    assert.ok(cn.startsWith('INDI-'))
  })
  await test('shortHash truncates long hashes', () => {
    const h = 'a'.repeat(64)
    const s = shortHash(h, 8)
    assert.ok(s.includes('…'))
    assert.ok(s.length < 64)
  })
  await test('shortHash returns em dash for null', () => {
    assert.equal(shortHash(null), '—')
  })

  // ── server up ─────────────────────────────────────────────────────────────
  await test('dev server responds', async () => {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(10_000) })
    assert.ok(res.status < 500, `server returned ${res.status}`)
  })

  // ── API: issue validation ─────────────────────────────────────────────────
  console.log('\nAPI — /api/issue')
  await test('POST /api/issue rejects empty body (400)', async () => {
    const { status } = await jsonPost('/api/issue', {})
    assert.equal(status, 400)
  })
  await test('POST /api/issue rejects unknown request (404)', async () => {
    const { status } = await jsonPost('/api/issue', {
      requestId: '00000000-0000-0000-0000-000000000000',
    })
    assert.equal(status, 404)
  })

  let issuedHash: string | null = null
  let issuedControl: string | null = null

  await test('POST /api/issue issues approved request end-to-end', async () => {
    await seedApprovedRequest()
    const { status, data } = await jsonPost('/api/issue', { requestId: TEST_REQUEST_ID })
    assert.equal(status, 200, JSON.stringify(data))
    const body = data as Record<string, unknown>
    assert.equal(body.status, 'issued')
    assert.ok(typeof body.controlNumber === 'string')
    assert.ok(typeof body.verifyUrl === 'string')
    issuedControl = body.controlNumber as string
  })

  await test('issued request persisted in Supabase', async () => {
    const db = supabase()
    const { data, error } = await db
      .from('requests')
      .select('status, doc_hash, control_number, chain_tx')
      .eq('id', TEST_REQUEST_ID)
      .single()
    if (error) throw new Error(error.message)
    assert.equal(data.status, 'issued')
    assert.ok(typeof data.doc_hash === 'string' && data.doc_hash.length === 64)
    issuedHash = data.doc_hash
    assert.equal(data.control_number, issuedControl)
    assert.ok(data.chain_tx)
  })

  await test('POST /api/issue returns the existing issuance idempotently', async () => {
    const { status, data } = await jsonPost('/api/issue', { requestId: TEST_REQUEST_ID })
    assert.equal(status, 200)
    assert.equal((data as Record<string, unknown>).controlNumber, issuedControl)
  })

  await test('GET /api/issue/download returns PDF', async () => {
    const res = await fetch(`${BASE}/api/issue/download?id=${TEST_REQUEST_ID}`)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    assert.ok(buf.byteLength > 1000, 'PDF too small')
    const fileHash = createHash('sha256').update(buf).digest('hex')
    assert.equal(fileHash, issuedHash, 'downloaded PDF hash must match doc_hash')
  })

  // ── verify pages ──────────────────────────────────────────────────────────
  console.log('\nPages — /verify')
  await test('GET /verify returns 200 (public)', async () => {
    const res = await fetch(`${BASE}/verify`)
    assert.equal(res.status, 200)
  })

  await test('GET /verify/[id] shows verified state for issued doc', async () => {
    const res = await fetch(`${BASE}/verify/${TEST_REQUEST_ID}`)
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(
      html.includes('Document Verified') || html.includes('Not Yet Anchored'),
      'expected verified or unanchored banner',
    )
    assert.ok(html.includes(issuedControl ?? ''), 'control number visible')
  })

  await test('GET /verify/[hash] resolves by doc_hash', async () => {
    const res = await fetch(`${BASE}/verify/${issuedHash}`)
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(!html.includes('Document Not Verified'), 'hash lookup should find document')
  })

  await test('GET /verify/[id] rejects unknown document', async () => {
    const res = await fetch(`${BASE}/verify/00000000-0000-0000-0000-000000000000`)
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.ok(html.includes('Document Not Verified'))
  })

  await test('GET /api/verify/control redirects to verify page', async () => {
    const res = await fetch(
      `${BASE}/api/verify/control?cn=${encodeURIComponent(issuedControl!)}`,
      { redirect: 'manual' },
    )
    assert.ok(res.status === 307 || res.status === 308 || res.status === 302)
    const loc = res.headers.get('location') ?? ''
    assert.ok(loc.includes(`/verify/${TEST_REQUEST_ID}`), `redirect was ${loc}`)
  })

  // ── harness pages ─────────────────────────────────────────────────────────
  console.log('\nHarnesses — /implementation/*')
  for (const path of [
    '/implementation/doc-issuance',
    '/implementation/egov-chain',
    '/implementation/verify-qr',
  ]) {
    await test(`GET ${path} returns 200`, async () => {
      const res = await fetch(`${BASE}${path}`)
      assert.equal(res.status, 200)
    })
  }

  await test('doc-issuance harness renders SHA-256 output', async () => {
    const res = await fetch(`${BASE}/implementation/doc-issuance`)
    const html = await res.text()
    assert.ok(html.includes('SHA-256') || html.includes('doc_hash'))
  })

  await test('egov-chain harness renders anchor result', async () => {
    const res = await fetch(`${BASE}/implementation/egov-chain`)
    const html = await res.text()
    assert.ok(
      html.includes('Hash matches') ||
        html.includes('local fallback') ||
        html.includes('Transaction hash'),
    )
  })

  // ── cleanup ─────────────────────────────────────────────────────────────────
  await cleanupTestRequest().catch(() => {})

  // ── summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`${passed}/${results.length} passed`)
  if (failed.length) {
    console.log('\nFailed:')
    for (const f of failed) console.log(`  • ${f.name}: ${f.error}`)
    process.exit(1)
  }
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
