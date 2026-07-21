/**
 * Hits every registered eGovPH endpoint once and reports what came back.
 *
 *   npx tsx scripts/probe.ts
 *
 * Run this BEFORE trusting any adapter. Two of our seven APIs (eGOV PAY, eGOV
 * chain) have no published endpoints, and the brief calls them the
 * highest-probability build failure. Finding that out at hour two is a
 * footnote; finding out at hour nine is the demo.
 *
 * Read-only where possible. The eGOV PAY probe is commented out by default
 * because "Generate Payment" may create a real sandbox transaction.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

type Probe = {
  service: string
  label: string
  run: () => Promise<{ status: number | string; note?: string; shape?: string }>
}

const TIMEOUT_MS = 12_000

async function hit(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...init.headers },
    })
    return { status: res.status, body: (await res.text()).slice(0, 2000) }
  } finally {
    clearTimeout(timer)
  }
}

/** Top-level key names, so we learn the response shape without dumping PII. */
function shapeOf(body: string): string {
  try {
    const json = JSON.parse(body)
    const target = json.data ?? json.result ?? json
    if (Array.isArray(target)) return `array[${target.length}]`
    return Object.keys(target).slice(0, 12).join(', ') || '(empty object)'
  } catch {
    return body.slice(0, 80).replace(/\s+/g, ' ')
  }
}

function base(service: string): string | null {
  return process.env[`EGOV_${service}_BASE_URL`]?.replace(/\/$/, '') || null
}

const probes: Probe[] = [
  {
    service: 'SSO',
    label: 'POST /api/token',
    run: async () => {
      const b = base('SSO')
      if (!b) return { status: 'skip', note: 'EGOV_SSO_BASE_URL not set' }
      const { status, body } = await hit(`${b}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.EGOV_SSO_CLIENT_ID,
          client_secret: process.env.EGOV_SSO_CLIENT_SECRET,
        }),
      })
      return { status, shape: shapeOf(body) }
    },
  },
  {
    service: 'EVERIFY',
    label: 'POST /api/auth',
    run: async () => {
      const b = base('EVERIFY')
      if (!b) return { status: 'skip', note: 'EGOV_EVERIFY_BASE_URL not set' }
      const { status, body } = await hit(`${b}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.EGOV_EVERIFY_CLIENT_ID,
          client_secret: process.env.EGOV_EVERIFY_CLIENT_SECRET,
        }),
      })
      return { status, shape: shapeOf(body) }
    },
  },
  {
    service: 'LIVENESS',
    label: 'POST /v1/liveness/session',
    run: async () => {
      const b = base('LIVENESS')
      if (!b) return { status: 'skip', note: 'EGOV_LIVENESS_BASE_URL not set' }
      const key = process.env.EGOV_LIVENESS_API_KEY ?? ''
      const { status, body } = await hit(`${b}/v1/liveness/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'x-api-key': key,
        },
        body: JSON.stringify({ reference: 'probe' }),
      })
      return { status, shape: shapeOf(body) }
    },
  },
  {
    service: 'AI',
    label: 'POST /api/token',
    run: async () => {
      const b = base('AI')
      if (!b) return { status: 'skip', note: 'EGOV_AI_BASE_URL not set' }
      const { status, body } = await hit(`${b}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.EGOV_AI_CLIENT_ID,
          client_secret: process.env.EGOV_AI_CLIENT_SECRET,
        }),
      })
      return { status, shape: shapeOf(body) }
    },
  },
  {
    service: 'EMESSAGE',
    label: 'POST /messaging/v1/sms/push (reachability only)',
    run: async () => {
      const b = base('EMESSAGE')
      if (!b) return { status: 'skip', note: 'EGOV_EMESSAGE_BASE_URL not set' }
      // Empty body on purpose: a 400/422 still proves the route exists and is
      // authenticating, without sending a real SMS to anyone.
      const { status, body } = await hit(`${b}/messaging/v1/sms/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EGOV_EMESSAGE_API_KEY ?? ''}`,
        },
        body: JSON.stringify({}),
      })
      return {
        status,
        note: '400/422 here is GOOD — route exists, payload rejected',
        shape: shapeOf(body),
      }
    },
  },
  {
    service: 'CHAIN',
    label: 'JSON-RPC eth_blockNumber + eth_accounts',
    run: async () => {
      const url = process.env.EGOV_CHAIN_RPC_URL
      if (!url) return { status: 'skip', note: 'EGOV_CHAIN_RPC_URL not set' }

      const { status, body } = await hit(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }),
      })

      let note = shapeOf(body)
      try {
        const block = JSON.parse(body).result
        const accountsRes = await hit(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_accounts', params: [] }),
        })
        const accounts = JSON.parse(accountsRes.body).result ?? []
        note =
          `block=${parseInt(block, 16)} accounts=${accounts.length}` +
          (accounts.length === 0
            ? ' — NO unlocked account, anchoring needs a signed raw tx'
            : '')
      } catch {
        /* fall through to the shape string */
      }

      return { status, note }
    },
  },
  {
    service: 'PAY',
    label: 'GET base URL (path discovery)',
    run: async () => {
      const b = base('PAY')
      if (!b) return { status: 'skip', note: 'EGOV_PAY_BASE_URL not set' }
      // Deliberately NOT calling Generate Payment — it may create a real
      // sandbox transaction. This only checks the host answers at all.
      const { status, body } = await hit(b, {
        headers: { Authorization: `Bearer ${process.env.EGOV_PAY_API_KEY ?? ''}` },
      })
      return {
        status,
        note: 'endpoints undocumented — get real paths from the Postman collection',
        shape: shapeOf(body),
      }
    },
  },
]

async function main() {
  console.log('\neGovPH sandbox probe\n' + '─'.repeat(72))

  for (const probe of probes) {
    const started = Date.now()
    let line: string

    try {
      const r = await probe.run()
      const ms = Date.now() - started
      const ok =
        typeof r.status === 'number' && r.status < 500 && r.status !== 404 ? '✓' : '✗'
      const mark = r.status === 'skip' ? '–' : ok

      line = `${mark} ${probe.service.padEnd(9)} ${String(r.status).padEnd(5)} ${String(ms).padStart(5)}ms  ${probe.label}`
      if (r.shape) line += `\n            shape: ${r.shape}`
      if (r.note) line += `\n            note:  ${r.note}`
    } catch (err) {
      const ms = Date.now() - started
      const msg = err instanceof Error ? err.message : String(err)
      line = `✗ ${probe.service.padEnd(9)} ERR   ${String(ms).padStart(5)}ms  ${probe.label}\n            ${msg}`
    }

    console.log(line)
  }

  console.log('─'.repeat(72))
  console.log('Any ✗ above → set that service to mock in .env.local before recording.\n')
}

main()
