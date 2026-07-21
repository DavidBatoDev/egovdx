import 'server-only'
import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { askAssistant, type ExtractionResult } from '@/lib/egov/ai'
import { egovMode, type EgovResult, type EgovSource } from '@/lib/egov/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ServiceTemplate } from '@/lib/supabase/types'
import { studioPrompt } from './prompts'
import {
  generatedServiceSchema,
  extractJsonObject,
  normalizeGeneratedService,
  parseGeneratedService,
  type GeneratedService,
} from './schema'

export type { GeneratedService } from './schema'
export type GenerationEngine = 'egov-ai' | 'openai' | 'mock'
export type GenerationResult = EgovResult<GeneratedService> & {
  engine: GenerationEngine
  model: string
  cacheHit: boolean
  primaryError?: string
}

export { extractJsonObject } from './schema'

export async function generateService(prompt: string, lguId: string): Promise<GenerationResult> {
  const normalized = prompt.trim()
  if (!normalized) throw new Error('Describe the service to generate')
  return generate(normalized, lguId, 'prompt', normalized)
}

export async function generateServiceFromExtraction(
  extraction: ExtractionResult,
  lguId: string,
): Promise<GenerationResult> {
  const normalized = JSON.stringify({
    title: extraction.documentTitle,
    fields: extraction.fields.map(({ label, key, type, sampleValue }) => ({ label, key, type, sampleValue })),
  })
  return generate(
    `Map this extracted blank government form into an approved service: ${normalized}`,
    lguId,
    'extraction',
    normalized,
  )
}

async function generate(
  input: string,
  lguId: string,
  inputKind: 'prompt' | 'extraction',
  cacheInput: string,
): Promise<GenerationResult> {
  const templates = await loadTemplates()
  if (!templates.length) throw new Error('No DICT service templates are configured')
  const hash = createHash('sha256').update(cacheInput.normalize('NFKC')).digest('hex')
  const cached = await readCache(lguId, inputKind, hash)
  if (cached) return { ...cached, cacheHit: true }

  if (egovMode('AI') === 'mock') {
    const result: GenerationResult = {
      data: mockService(input, templates),
      source: 'mock',
      engine: 'mock',
      model: 'deterministic-studio-fixture-v1',
      cacheHit: false,
    }
    await writeCache(lguId, inputKind, hash, result)
    return result
  }

  const fullPrompt = studioPrompt(input, templates)
  let primaryError: string | undefined
  const primary = await askAssistant(fullPrompt)
  if (primary.source === 'live') {
    try {
      const service = parseGeneratedService(extractJsonObject(primary.data))
      ensureKnownTemplate(service, templates)
      const result: GenerationResult = {
        data: service,
        source: 'live',
        engine: 'egov-ai',
        model: 'egov-ai-assistant',
        cacheHit: false,
      }
      await writeCache(lguId, inputKind, hash, result)
      return result
    } catch (error) {
      primaryError = errorMessage(error)
    }
  } else {
    primaryError = primary.error ?? 'eGov AI was unavailable'
  }

  const model = process.env.OPENAI_STUDIO_MODEL || 'gpt-5.4-mini'
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(`Generation failed: ${primaryError}. OPENAI_API_KEY is not configured.`)
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.parse({
      model,
      reasoning: { effort: 'low' },
      input: [{ role: 'user', content: fullPrompt }],
      text: { format: zodTextFormat(generatedServiceSchema, 'generated_service') },
    })
    if (!response.output_parsed) throw new Error('OpenAI returned no parsed service')
    const service = normalizeGeneratedService(response.output_parsed)
    ensureKnownTemplate(service, templates)
    const result: GenerationResult = {
      data: service,
      source: 'live',
      engine: 'openai',
      model,
      cacheHit: false,
      primaryError,
    }
    await writeCache(lguId, inputKind, hash, result)
    return result
  } catch (error) {
    throw new Error(`Generation failed: ${primaryError}. OpenAI fallback failed: ${errorMessage(error)}`)
  }
}

async function loadTemplates(): Promise<ServiceTemplate[]> {
  const { data, error } = await supabaseAdmin().from('service_templates').select('*').order('code')
  if (error) throw error
  return data ?? []
}

function ensureKnownTemplate(service: GeneratedService, templates: ServiceTemplate[]) {
  if (!templates.some((template) => template.code === service.templateCode)) {
    throw new Error(`Unknown template code: ${service.templateCode}`)
  }
}

async function readCache(lguId: string, inputKind: 'prompt' | 'extraction', hash: string): Promise<GenerationResult | null> {
  const { data, error } = await supabaseAdmin()
    .from('studio_generation_cache')
    .select('result,engine,model,source,primary_error')
    .eq('lgu_id', lguId)
    .eq('input_kind', inputKind)
    .eq('input_hash', hash)
    .maybeSingle()
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    throw error
  }
  if (!data) return null
  return {
    data: parseGeneratedService(data.result),
    source: data.source as EgovSource,
    engine: data.engine as GenerationEngine,
    model: data.model,
    cacheHit: true,
    ...(data.primary_error ? { primaryError: data.primary_error } : {}),
  }
}

async function writeCache(lguId: string, inputKind: 'prompt' | 'extraction', hash: string, result: GenerationResult) {
  const { error } = await supabaseAdmin().from('studio_generation_cache').upsert({
    lgu_id: lguId,
    input_kind: inputKind,
    input_hash: hash,
    result: result.data,
    engine: result.engine,
    model: result.model,
    source: result.source,
    primary_error: result.primaryError ?? null,
  }, { onConflict: 'lgu_id,input_kind,input_hash' })
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error
}

function mockService(input: string, templates: ServiceTemplate[]): GeneratedService {
  const lower = input.toLowerCase()
  const template = templates.find((item) =>
    lower.includes('indigency') ? item.code.includes('INDIGENCY')
      : lower.includes('business') || lower.includes('sanitation') ? item.code.includes('BIZ')
      : item.code.includes('CLEARANCE'),
  ) ?? templates[0]
  const fee = Number(lower.match(/(?:₱|php\s*)\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0)
  return {
    templateCode: template.code,
    name: /tricycle/i.test(input) ? 'Tricycle Franchise Renewal' : template.name,
    formFields: template.base_fields,
    feeAmount: fee,
    waivers: [],
    requiredDocs: /or\/?cr/i.test(input) ? ['Official Receipt and Certificate of Registration', 'Barangay Clearance'] : [],
    eligibility: {},
    approvalOffice: /health/i.test(input) ? 'Municipal Health Office' : null,
    confidence: 0.82,
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}
