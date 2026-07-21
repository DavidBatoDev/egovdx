import { z } from 'zod'
import type { Eligibility, FormField, Waiver } from '@/lib/supabase/types'

const formFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'textarea']),
  required: z.boolean(),
  options: z.array(z.string()),
  source: z.enum(['everify']).nullable(),
})

const editableFormFieldSchema = formFieldSchema.extend({
  options: z.array(z.string()).default([]),
  source: z.enum(['everify']).nullable().optional().default(null),
})

const waiverSchema = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  waives: z.enum(['full', 'partial']),
  amount: z.number().nonnegative().nullable(),
})

const editableWaiverSchema = waiverSchema.extend({ amount: z.number().nonnegative().nullable().optional().default(null) })

/**
 * eVerify already supplies these attributes after identity verification. Keep
 * this list deliberately flat: generated form labels vary, but the citizen
 * form needs one unambiguous signal that the value must be prefilled instead
 * of requested again.
 */
const EVERIFY_PROFILE_FIELD_KEYS = new Set([
  'full_name', 'name', 'first_name', 'middle_name', 'last_name', 'suffix',
  'email', 'birth_date', 'date_of_birth', 'gender', 'nationality', 'mobile',
  'mobile_number', 'address', 'complete_address', 'residential_address',
  'street', 'barangay', 'municipality', 'city', 'province', 'region',
  'country', 'postal', 'postal_code', 'address_line_2', 'photo', 'signature',
])

function isEverifyProfileField(field: { key: string; label: string }) {
  const key = field.key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const label = field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return EVERIFY_PROFILE_FIELD_KEYS.has(key) || EVERIFY_PROFILE_FIELD_KEYS.has(label)
}

export const generatedServiceSchema = z.object({
  templateCode: z.string().min(1),
  name: z.string().min(1),
  formFields: z.array(formFieldSchema),
  feeAmount: z.number().nonnegative(),
  waivers: z.array(waiverSchema),
  requiredDocs: z.array(z.string()),
  eligibility: z.object({
    min_residency_years: z.number().nonnegative().nullable(),
    min_age: z.number().nonnegative().nullable(),
    max_monthly_income: z.number().nonnegative().nullable(),
  }),
  approvalOffice: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

const editableGeneratedServiceSchema = generatedServiceSchema.extend({
  formFields: z.array(editableFormFieldSchema),
  waivers: z.array(editableWaiverSchema),
  eligibility: z.object({
    min_residency_years: z.number().nonnegative().nullable().optional().default(null),
    min_age: z.number().nonnegative().nullable().optional().default(null),
    max_monthly_income: z.number().nonnegative().nullable().optional().default(null),
  }),
})

type RawGeneratedService = z.infer<typeof generatedServiceSchema>

export type GeneratedService = {
  templateCode: string
  name: string
  formFields: FormField[]
  feeAmount: number
  waivers: Waiver[]
  requiredDocs: string[]
  eligibility: Eligibility
  approvalOffice: string | null
  confidence: number
}

export function normalizeGeneratedService(raw: RawGeneratedService): GeneratedService {
  return {
    ...raw,
    formFields: raw.formFields.map(({ options, source, ...field }) => ({
      ...field,
      ...(options.length ? { options } : {}),
      ...(source || isEverifyProfileField(field) ? { source: 'everify' as const } : {}),
    })),
    waivers: raw.waivers.map(({ amount, ...waiver }) => ({
      ...waiver,
      ...(amount == null ? {} : { amount }),
    })),
    eligibility: Object.fromEntries(
      Object.entries(raw.eligibility).filter(([, value]) => value != null),
    ) as Eligibility,
  }
}

export function parseGeneratedService(value: unknown): GeneratedService {
  return normalizeGeneratedService(editableGeneratedServiceSchema.parse(value))
}

export function extractJsonObject(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI response did not contain a JSON object')
  return JSON.parse(unfenced.slice(start, end + 1))
}
