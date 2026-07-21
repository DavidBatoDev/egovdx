import { config } from 'dotenv'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'
config({ path: '.env.local' })

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
let passed = 0
let failed = 0
const created: string[] = []

async function check(name: string, run: () => Promise<void>) { try { await run(); passed++; console.log(`  ✓ ${name}`) } catch (error) { failed++; console.log(`  ✗ ${name}\n    ${error instanceof Error ? error.message : error}`) } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }

async function cookie(sub: string) {
  const token = await new SignJWT({ sub, name: 'Unrehearsed Citizen', role: 'citizen', lguId: null, mobile: '+639170000001', firstName: 'Ana', middleName: 'Reyes', lastName: 'Mabini', suffix: '', birthDate: '1991-05-20', address: 'Malolos, Bulacan', ssoSource: 'mock' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SESSION_SECRET!))
  return `egovdx_session=${token}`
}

async function request(path: string, auth: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { Cookie: auth, ...init.headers } })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

async function main() {
  console.log(`\nCitizen application tests — ${BASE}\n`)
  const { data: service } = await db.from('lgu_services').select('id, form_fields, required_docs, fee_amount').eq('status', 'published').limit(1).single()
  assert(service, 'No published service is available')
  const auth = await cookie(`citizen-${Date.now()}`)
  let id = ''
  await check('starts a resumable draft for a published service', async () => {
    const first = await request('/api/applications', auth, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: service.id }) })
    assert(first.response.status === 200, JSON.stringify(first.body)); id = first.body.requestId; created.push(id)
    const second = await request('/api/applications', auth, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: service.id }) })
    assert(second.body.requestId === id, 'draft was not resumed')
  })
  await check('rejects a different citizen', async () => { const other = await cookie('different-citizen'); const result = await request(`/api/requests/${id}/payment`, other, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert(result.response.status === 403, `expected 403, got ${result.response.status}`) })
  await check('records mock liveness and eVerify with source metadata', async () => { const result = await request(`/api/applications/${id}/identity`, auth, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: `mock-liveness-${id}` }) }); assert(result.response.status === 200, JSON.stringify(result.body)); assert(result.body.source === 'mock', 'source was not mock') })
  await check('validates and saves an arbitrary generated field list', async () => {
    const formData: Record<string, unknown> = {}
    for (const field of service.form_fields as Array<{ key: string; type: string; source?: string; options?: string[] }>) { if (field.source === 'everify') continue; formData[field.key] = field.type === 'number' ? 2 : field.type === 'date' ? '2026-08-01' : field.type === 'select' ? field.options?.[0] ?? '' : `Unrehearsed ${field.key}` }
    const result = await request(`/api/applications/${id}/form`, auth, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formData }) }); assert(result.response.status === 200, JSON.stringify(result.body))
  })
  for (const requirement of service.required_docs as string[]) await check(`uploads required evidence: ${requirement}`, async () => { const form = new FormData(); form.set('requirement', requirement); form.set('file', new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'evidence.png', { type: 'image/png' })); const result = await request(`/api/applications/${id}/documents`, auth, { method: 'POST', body: form }); assert(result.response.status === 200, JSON.stringify(result.body)) })
  await check('completes fee or waiver before submission', async () => { const start = await request(`/api/requests/${id}/payment`, auth, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert(start.response.status === 200, JSON.stringify(start.body)); if (start.body.feeStatus === 'unpaid') { const finish = await request(`/api/requests/${id}/payment`, auth, { method: 'GET' }); assert(finish.body.feeStatus === 'paid', JSON.stringify(finish.body)) } })
  await check('submits once and writes the audit timeline', async () => { const result = await request(`/api/applications/${id}/submit`, auth, { method: 'POST' }); assert(result.response.status === 200, JSON.stringify(result.body)); const { data: row } = await db.from('requests').select('status, everify_reference, uploaded_docs').eq('id', id).single(); assert(row?.status === 'submitted', 'request was not submitted'); const { data: events } = await db.from('request_events').select('event').eq('request_id', id); assert(events?.some((event) => event.event === 'submitted'), 'submitted audit event missing') })

  for (const requestId of created) { const { data } = await db.from('requests').select('uploaded_docs').eq('id', requestId).maybeSingle(); const paths = Array.isArray(data?.uploaded_docs) ? data.uploaded_docs.map((item: { path?: string }) => item.path).filter((path): path is string => Boolean(path)) : []; if (paths.length) await db.storage.from('application-documents').remove(paths); await db.from('requests').delete().eq('id', requestId) }
  console.log(`\n${passed}/${passed + failed} passed\n`)
  if (failed) process.exitCode = 1
}

void main()
