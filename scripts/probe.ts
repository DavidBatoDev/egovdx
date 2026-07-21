import { config } from 'dotenv'
config({ path: '.env.local' })

type Result = { status: number | 'skip'; keys?: string; note?: string }
type Probe = { service: string; endpoint: string; run: () => Promise<Result> }
const TIMEOUT_MS = 12_000

async function hit(url: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init.headers } })
    return { status: response.status, body: await response.text() }
  } finally { clearTimeout(timer) }
}

function keys(body: string) {
  try {
    const value = JSON.parse(body)
    const target = value?.data ?? value?.result ?? value
    return target && typeof target === 'object' ? Object.keys(target).slice(0, 12).join(', ') || '(empty)' : typeof target
  } catch { return '(non-JSON response)' }
}

function base(service: string) { return process.env[`EGOV_${service}_BASE_URL`]?.replace(/\/$/, '') }
function skip(service: string): Result { return { status: 'skip', note: `EGOV_${service}_BASE_URL not set` } }

const probes: Probe[] = [
  { service: 'SSO', endpoint: 'POST /api/token (validation only)', run: async () => {
    const b = base('SSO'); if (!b) return skip('SSO')
    const result = await hit(`${b}/api/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exchange_code: 'probe-invalid-code', scope: 'SSO_AUTHENTICATION', partner_code: process.env.EGOV_SSO_PARTNER_CODE, partner_secret: process.env.EGOV_SSO_PARTNER_SECRET }) })
    return { status: result.status, keys: keys(result.body), note: '403/422 confirms the non-mutating validation path' }
  }},
  { service: 'EVERIFY', endpoint: 'POST /api/auth', run: async () => {
    const b = base('EVERIFY'); if (!b) return skip('EVERIFY')
    const result = await hit(`${b}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.EGOV_EVERIFY_CLIENT_ID, client_secret: process.env.EGOV_EVERIFY_CLIENT_SECRET }) })
    return { status: result.status, keys: keys(result.body) }
  }},
  { service: 'LIVENESS', endpoint: 'POST /v1/liveness/session (validation only)', run: async () => {
    const b = base('LIVENESS'); if (!b) return skip('LIVENESS')
    const result = await hit(`${b}/v1/liveness/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EGOV_LIVENESS_API_KEY ?? '' }, body: '{}' })
    return { status: result.status, keys: keys(result.body), note: '400/422 confirms route and auth without creating a session' }
  }},
  { service: 'EMESSAGE', endpoint: 'POST /messaging/v1/sms/push (validation only)', run: async () => {
    const b = base('EMESSAGE'); if (!b) return skip('EMESSAGE')
    const result = await hit(`${b}/messaging/v1/sms/push`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-EMESSAGE-Auth': process.env.EGOV_EMESSAGE_API_TOKEN ?? '' }, body: '{}' })
    return { status: result.status, keys: keys(result.body), note: '400/422 confirms route and auth; no SMS is sent' }
  }},
  { service: 'AI', endpoint: 'POST /integration/token → GET /credits', run: async () => {
    const b = base('AI'); if (!b) return skip('AI')
    const tokenResult = await hit(`${b}/api/v1/egov/integration/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_code: process.env.EGOV_AI_ACCESS_CODE }) })
    if (tokenResult.status >= 300) return { status: tokenResult.status, keys: keys(tokenResult.body) }
    const token = JSON.parse(tokenResult.body).access_token
    const credits = await hit(`${b}/api/v1/egov/integration/credits`, { headers: { Authorization: `Bearer ${token}` } })
    return { status: credits.status, keys: keys(credits.body) }
  }},
  { service: 'PAY', endpoint: 'GET /api/v1/transaction/{invalid} (read-only)', run: async () => {
    const b = base('PAY'); if (!b) return skip('PAY')
    const result = await hit(`${b}/api/v1/transaction/00000000-0000-0000-0000-000000000000`, { headers: { 'X-eGovPay-Token': process.env.EGOV_PAY_API_TOKEN ?? '' } })
    return { status: result.status, keys: keys(result.body), note: '404 is expected and proves the read-only route exists' }
  }},
  { service: 'CHAIN', endpoint: 'JSON-RPC rpc_modules (read-only)', run: async () => {
    const url = process.env.EGOV_CHAIN_RPC_URL; if (!url) return { status: 'skip', note: 'EGOV_CHAIN_RPC_URL not set' }
    const result = await hit(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'rpc_modules', params: [], id: 1 }) })
    return { status: result.status, keys: keys(result.body) }
  }},
]

async function main() {
  console.log('\neGovPH read-only / validation-only probe')
  for (const probe of probes) {
    const started = Date.now()
    try {
      const result = await probe.run()
      const ok = result.status === 'skip' ? '–' : result.status < 500 && result.status !== 401 && result.status !== 403 ? '✓' : '✗'
      console.log(`${ok} ${probe.service.padEnd(9)} ${String(result.status).padEnd(5)} ${String(Date.now() - started).padStart(5)}ms  ${probe.endpoint}`)
      if (result.keys) console.log(`            keys: ${result.keys}`)
      if (result.note) console.log(`            note: ${result.note}`)
    } catch (error) { console.log(`✗ ${probe.service.padEnd(9)} ERR   ${error instanceof Error ? error.message : String(error)}`) }
  }
  console.log('\nOnly switch a service to live after its probe succeeds. No credentials, tokens, or PII were printed.\n')
}
void main()
