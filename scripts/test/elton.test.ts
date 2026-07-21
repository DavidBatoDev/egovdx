import { config } from 'dotenv'
import { strict as assert } from 'node:assert'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000'
const PAY_ID = 'eeeeeeee-0000-0000-0000-000000000001'
const WAIVE_ID = 'eeeeeeee-0000-0000-0000-000000000002'
const REJECT_ID = 'eeeeeeee-0000-0000-0000-000000000003'
let paidFee = 0
let officerLguId = ''

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) }
async function cookie(role: 'citizen'|'officer', sub: string, lguId: string | null) {
  const token = await new SignJWT({ sub, name: role === 'officer' ? 'Maria Santos' : 'Demo Citizen', role, lguId, mobile: '+639171234567' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SESSION_SECRET!))
  return `egovdx_session=${token}`
}
async function api(path: string, method: 'GET'|'POST', auth: string, body?: unknown) {
  const response = await fetch(`${BASE}${path}`, { method, headers: { Cookie: auth, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json().catch(() => null)
  return { response, data }
}
async function seed() {
  const client = db()
  await cleanup()
  const { data: officer, error: officerError } = await client.from('officers').select('lgu_id').eq('egov_sub', 'demo-officer-sub').eq('role', 'officer').maybeSingle()
  if (officerError || !officer) throw new Error(officerError?.message ?? 'Demo officer is not assigned to an LGU')
  officerLguId = officer.lgu_id
  const { data: paidService, error: paidError } = await client.from('lgu_services').select('id,fee_amount').eq('lgu_id', officerLguId).eq('status', 'published').gt('fee_amount', 0).limit(1).maybeSingle()
  const { data: freeService, error: freeError } = await client.from('lgu_services').select('id').eq('status', 'published').eq('fee_amount', 0).limit(1).maybeSingle()
  if (paidError || !paidService) throw new Error(paidError?.message ?? 'No paid published service available')
  if (freeError || !freeService) throw new Error(freeError?.message ?? 'No free published service available')
  paidFee = Number(paidService.fee_amount)
  const common = { citizen_sub: 'demo-citizen-sub', citizen_name: 'Demo Citizen', citizen_mobile: '+639171234567', everify_payload: { full_name: 'Demo Citizen', reference: 'EV-ELTON-001' }, liveness_passed: true, liveness_score: 98.5, everify_reference: 'EV-ELTON-001', form_data: { purpose: 'Employment' }, status: 'submitted' }
  const { error } = await client.from('requests').insert([
    { ...common, id: PAY_ID, lgu_service_id: paidService.id, fee_due: paidFee, fee_status: 'unpaid' },
    { ...common, id: WAIVE_ID, lgu_service_id: freeService.id, fee_due: 0, fee_status: 'unpaid' },
    { ...common, id: REJECT_ID, lgu_service_id: paidService.id, fee_due: paidFee, fee_status: 'paid' },
  ])
  if (error) throw new Error(error.message)
}
async function cleanup() {
  const client = db()
  const ids = [PAY_ID, WAIVE_ID, REJECT_ID]
  const { data } = await client.from('requests').select('pdf_path').in('id', ids)
  const paths = (data ?? []).map((row) => row.pdf_path).filter(Boolean) as string[]
  if (paths.length) await client.storage.from('documents').remove(paths)
  await client.from('request_events').delete().in('request_id', ids)
  await client.from('requests').delete().in('id', ids)
}

async function main() {
  assert.equal((await fetch(BASE)).status < 500, true)
  await seed()
  const citizen = await cookie('citizen', 'demo-citizen-sub', null)
  const officer = await cookie('officer', 'demo-officer-sub', officerLguId)

  let result = await api(`/api/requests/${PAY_ID}/payment`, 'POST', citizen, {})
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.feeDue, paidFee)
  assert.equal(result.data.source, 'mock')
  result = await api(`/api/requests/${PAY_ID}/payment`, 'GET', citizen)
  assert.equal(result.data.feeStatus, 'paid')

  result = await api(`/api/requests/${WAIVE_ID}/payment`, 'POST', citizen, {})
  assert.equal(result.data.feeStatus, 'waived')
  assert.equal(result.data.feeDue, 0)

  result = await api(`/api/requests/${PAY_ID}/approve`, 'POST', citizen, {})
  assert.equal(result.response.status, 403)
  result = await api(`/api/requests/${PAY_ID}/approve`, 'POST', officer, {})
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.status, 'issued')
  assert.equal(result.data.chainSource, 'mock')
  assert.equal(result.data.smsStatus, 'sent')
  const firstControl = result.data.controlNumber
  result = await api(`/api/requests/${PAY_ID}/approve`, 'POST', officer, {})
  assert.equal(result.data.controlNumber, firstControl)

  result = await api(`/api/requests/${REJECT_ID}/reject`, 'POST', officer, { note: 'Missing supporting document' })
  assert.equal(result.response.status, 200, JSON.stringify(result.data))
  assert.equal(result.data.status, 'rejected')

  const entry = await fetch(`${BASE}/lgu`, { headers: { Cookie: officer }, redirect: 'manual' })
  assert.equal(entry.status, 307)
  const scopedPath = new URL(entry.headers.get('location')!, BASE).pathname
  const queue = await fetch(`${BASE}${scopedPath}/requests`, { headers: { Cookie: officer }, redirect: 'manual' })
  const analytics = await fetch(`${BASE}${scopedPath}/analytics`, { headers: { Cookie: officer }, redirect: 'manual' })
  assert.equal(queue.status, 200)
  assert.equal(analytics.status, 200)
  const wrongScope = await fetch(`${BASE}/lgu/city/not-the-assigned-lgu/requests`, { headers: { Cookie: officer }, redirect: 'manual' })
  assert.equal(wrongScope.status, 307)
  assert.equal(new URL(wrongScope.headers.get('location')!, BASE).pathname, `${scopedPath}/requests`)
  assert.equal((await fetch(`${BASE}/console`, { headers: { Cookie: officer }, redirect: 'manual' })).status, 404)

  const { data: issued } = await db().from('requests').select('status, issuance_status, doc_hash, chain_source, sms_status, control_number').eq('id', PAY_ID).single()
  assert.equal(issued?.status, 'issued')
  assert.equal(issued?.issuance_status, 'issued')
  assert.equal(issued?.chain_source, 'mock')
  assert.equal(issued?.sms_status, 'sent')
  assert.match(issued?.control_number ?? '', /^[A-Z]{1,4}-\d{4}-\d{6}$/)
  console.log('Elton pipeline: payment, waiver, authorization, approval, issuance, SMS, rejection, and analytics passed')
  await cleanup()
}

main().catch(async (error) => { console.error(error); await cleanup().catch(() => {}); process.exitCode = 1 })
