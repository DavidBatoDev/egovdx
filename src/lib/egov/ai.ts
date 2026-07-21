import 'server-only'
import { callEgov, egovFetch, getAccessToken, type EgovResult } from './client'
import type { FormField } from '../supabase/types'

/**
 * eGov AI — Document Extractor + Translator.
 *
 * This is the API that makes the whole configuration thesis work. An officer
 * uploads the paper form they already use; the extractor reads its fields; we
 * map those against the nearest DICT template and flag anything outside the
 * approved parameter set. Without it, "upload your form and we'll configure it"
 * is just a manual data-entry screen with extra steps.
 *
 * Token credits are metered — check them before recording the demo.
 */

async function token(): Promise<string> {
  return getAccessToken('AI', async () => {
    const res = await egovFetch<Record<string, any>>('AI', '/api/token', {
      method: 'POST',
      body: JSON.stringify({
        client_id: process.env.EGOV_AI_CLIENT_ID,
        client_secret: process.env.EGOV_AI_CLIENT_SECRET,
      }),
    })

    const accessToken = res.access_token ?? res.token ?? res.data?.access_token
    if (!accessToken) throw new Error('eGov AI token endpoint returned no token')

    return { token: accessToken, expiresInSeconds: res.expires_in ?? 3600 }
  })
}

export type ExtractedField = {
  label: string
  /** Best-guess machine key derived from the label. */
  key: string
  type: FormField['type']
  sampleValue?: string
  confidence: number | null
}

export type ExtractionResult = {
  documentTitle: string | null
  fields: ExtractedField[]
}

/** Document Extractor — reads an uploaded form image or DOCX. */
export async function extractDocument(
  file: Blob,
  filename: string,
): Promise<EgovResult<ExtractionResult>> {
  return callEgov(
    'AI',
    async () => {
      const form = new FormData()
      form.append('file', file, filename)

      const raw = await egovFetch<Record<string, any>>('AI', '/api/document-extractor', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
        body: form,
        timeoutMs: 45_000, // extraction is slower than a plain lookup
      })

      return normalizeExtraction(raw)
    },
    () => mockExtraction(),
  )
}

/** Translator — for multilingual barangay forms. */
export async function translate(
  text: string,
  targetLanguage: string,
): Promise<EgovResult<string>> {
  return callEgov(
    'AI',
    async () => {
      const raw = await egovFetch<Record<string, any>>('AI', '/api/translator', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ text, target_language: targetLanguage }),
      })
      return raw.translation ?? raw.data?.translation ?? raw.result ?? text
    },
    () => text,
  )
}

/** Token Credits — check quota before demo day. */
export async function tokenCredits(): Promise<EgovResult<{ remaining: number | null }>> {
  return callEgov(
    'AI',
    async () => {
      const raw = await egovFetch<Record<string, any>>('AI', '/api/token-credits', {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const d = raw.data ?? raw
      return { remaining: d.credits ?? d.remaining ?? d.balance ?? null }
    },
    () => ({ remaining: null }),
  )
}

function normalizeExtraction(raw: Record<string, any>): ExtractionResult {
  const d = raw.data ?? raw.result ?? raw
  const rawFields: any[] = d.fields ?? d.extractedFields ?? d.entities ?? []

  return {
    documentTitle: d.title ?? d.documentTitle ?? null,
    fields: rawFields.map((f) => {
      const label = String(f.label ?? f.name ?? f.key ?? 'Untitled Field')
      return {
        label,
        key: toKey(label),
        type: guessType(label, f.value),
        sampleValue: f.value != null ? String(f.value) : undefined,
        confidence: f.confidence ?? f.score ?? null,
      }
    }),
  }
}

function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/** Cheap heuristic — the officer confirms or corrects every field anyway. */
function guessType(label: string, value: unknown): FormField['type'] {
  const l = label.toLowerCase()
  if (/(date|birth|issued|expiry|petsa)/.test(l)) return 'date'
  if (/(amount|fee|income|capital|number of|age|years|bilang)/.test(l)) return 'number'
  if (/(purpose|remarks|address|reason|layunin)/.test(l)) return 'textarea'
  if (typeof value === 'number') return 'number'
  return 'text'
}

/**
 * Fixture mirrors a real Barangay Clearance form so the console demo is
 * meaningful even with the AI service off or out of credits.
 */
function mockExtraction(): ExtractionResult {
  return {
    documentTitle: 'Barangay Clearance Application Form',
    fields: [
      { label: 'Full Name', key: 'full_name', type: 'text', confidence: 0.98 },
      { label: 'Complete Address', key: 'complete_address', type: 'textarea', confidence: 0.96 },
      { label: 'Date of Birth', key: 'date_of_birth', type: 'date', confidence: 0.95 },
      { label: 'Years of Residency', key: 'years_of_residency', type: 'number', confidence: 0.93 },
      { label: 'Purpose', key: 'purpose', type: 'textarea', confidence: 0.97 },
      { label: 'Civil Status', key: 'civil_status', type: 'text', confidence: 0.91 },
      { label: 'Cedula Number', key: 'cedula_number', type: 'text', confidence: 0.84 },
    ],
  }
}
