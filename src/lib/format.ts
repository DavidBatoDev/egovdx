/**
 * Formatting helpers. Shared by server and client components — no 'server-only'.
 */

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

export function peso(amount: number): string {
  return PESO.format(amount)
}

const DATE_TIME = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
})

const DATE_ONLY = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeZone: 'Asia/Manila',
})

/** Always rendered in Asia/Manila so a server in another region can't shift dates. */
export function dateTime(iso: string | null): string {
  if (!iso) return '—'
  return DATE_TIME.format(new Date(iso))
}

export function dateOnly(iso: string | null): string {
  if (!iso) return '—'
  return DATE_ONLY.format(new Date(iso))
}

/**
 * Control numbers are what a barangay actually files by, so they follow the
 * shape officers already recognise: BRGY-YYYY-NNNNNN.
 */
export function controlNumber(templateCode: string, sequence: number): string {
  const prefix = templateCode.split('_')[0].slice(0, 4).toUpperCase()
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`
}

/** Long hashes are unreadable in a table; show the ends and keep the middle out. */
export function shortHash(hash: string | null, chars = 8): string {
  if (!hash) return '—'
  const clean = hash.replace(/^0x/, '')
  if (clean.length <= chars * 2) return clean
  return `${clean.slice(0, chars)}…${clean.slice(-chars)}`
}
