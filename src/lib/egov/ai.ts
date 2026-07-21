import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- external eGov payloads are normalized below */
import { callEgov, egovFetch, getAccessToken, type EgovResult } from './client'
import type { FormField } from '../supabase/types'
import { parseExtractionHtml as parseHtml, toKey as fieldKey, guessType as inferType } from '../studio/extract'

async function token(): Promise<string> {
  return getAccessToken('AI', async () => {
    const res = await egovFetch<Record<string, any>>(
      'AI',
      '/api/v1/egov/integration/token',
      {
        method: 'POST',
        body: JSON.stringify({ access_code: process.env.EGOV_AI_ACCESS_CODE }),
      },
    )
    const accessToken = res.access_token ?? res.data?.access_token
    if (!accessToken) throw new Error('eGov AI token endpoint returned no token')
    return { token: accessToken, expiresInSeconds: res.expires_in_seconds ?? 3600 }
  })
}

export async function askAssistant(prompt: string): Promise<EgovResult<string>> {
  return callEgov(
    'AI',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'AI',
        '/api/v1/egov/integration/ai_assistant/generate',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${await token()}` },
          body: JSON.stringify({ prompt, category: 'PH' }),
          timeoutMs: 45_000,
        },
      )
      const answer = raw.data ?? raw.result ?? raw.answer
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('eGov AI assistant returned no answer')
      }
      return answer
    },
    () => '',
  )
}

export type ExtractedField = {
  label: string
  key: string
  type: FormField['type']
  sampleValue?: string
  confidence: number | null
}

export type ExtractionResult = {
  documentTitle: string | null
  fields: ExtractedField[]
}

export async function extractDocument(
  file: Blob,
  filename: string,
): Promise<EgovResult<ExtractionResult>> {
  return callEgov(
    'AI',
    async () => {
      const form = new FormData()
      form.append('file', file, filename)
      const raw = await egovFetch<Record<string, any>>(
        'AI',
        '/api/v1/egov/integration/document_extractor/generate',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${await token()}` },
          body: form,
          timeoutMs: 45_000,
        },
      )
      return normalizeExtraction(raw.data ?? raw.result ?? raw)
    },
    mockExtraction,
  )
}

export async function translate(text: string, targetLanguage: string): Promise<EgovResult<string>> {
  return callEgov(
    'AI',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'AI',
        '/api/v1/egov/integration/translator/generate',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${await token()}` },
          body: JSON.stringify({ prompt: text, source_lang: 'en', target_lang: targetLanguage }),
        },
      )
      return raw.translated_prompt ?? raw.data?.translated_prompt ?? text
    },
    () => text,
  )
}

export async function tokenCredits(): Promise<EgovResult<{ remaining: number | null }>> {
  return callEgov(
    'AI',
    async () => {
      const raw = await egovFetch<Record<string, any>>(
        'AI',
        '/api/v1/egov/integration/credits',
        { headers: { Authorization: `Bearer ${await token()}` } },
      )
      const data = raw.data ?? raw
      return { remaining: data.credits_remaining ?? null }
    },
    () => ({ remaining: null }),
  )
}

export function normalizeExtraction(raw: Record<string, any> | string): ExtractionResult {
  if (typeof raw === 'string') return parseExtractionHtml(raw)
  const data = raw.data ?? raw.result ?? raw
  if (typeof data === 'string') return parseExtractionHtml(data)
  const rawFields: any[] = data.fields ?? data.extractedFields ?? data.entities ?? []
  return {
    documentTitle: data.title ?? data.documentTitle ?? null,
    fields: rawFields.map((field) => {
      const label = String(field.label ?? field.name ?? field.key ?? 'Untitled Field')
      return {
        label,
        key: toKey(label),
        type: guessType(label, field.value),
        sampleValue: field.value == null ? undefined : String(field.value),
        confidence: field.confidence ?? field.score ?? null,
      }
    }),
  }
}

export function parseExtractionHtml(html: string): ExtractionResult {
  return parseHtml(html)
}

export function toKey(label: string): string {
  return fieldKey(label)
}

export function guessType(label: string, value: unknown): FormField['type'] {
  return inferType(label, value)
}

function mockExtraction(): ExtractionResult {
  return {
    documentTitle: 'Barangay Clearance Application Form',
    fields: [
      { label: 'Full Name', key: 'full_name', type: 'text', confidence: 0.98 },
      { label: 'Complete Address', key: 'complete_address', type: 'textarea', confidence: 0.96 },
      { label: 'Date of Birth', key: 'date_of_birth', type: 'date', confidence: 0.95 },
      { label: 'Years of Residency', key: 'years_of_residency', type: 'number', confidence: 0.93 },
      { label: 'Purpose', key: 'purpose', type: 'textarea', confidence: 0.97 },
    ],
  }
}
