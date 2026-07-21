import assert from 'node:assert/strict'
import test from 'node:test'
import { extractJsonObject, parseGeneratedService } from './schema'
import { guessType, parseExtractionHtml, toKey } from './extract'
import { validateService } from '@/lib/rules/validate'
import type { GeneratedService } from './schema'
import type { ServiceTemplate } from '@/lib/supabase/types'

test('extracts fenced and prose-wrapped JSON', () => assert.deepEqual(extractJsonObject('Result:\n```json\n{"ok":true}\n```'), { ok: true }))
test('rejects malformed JSON', () => assert.throws(() => extractJsonObject('{broken}')))
test('rejects schema-invalid generation', () => assert.throws(() => parseGeneratedService({ templateCode: 'X' })))
test('marks government profile fields for eVerify prefill', () => {
  const service = parseGeneratedService({
    templateCode: 'TEST', name: 'Test service', feeAmount: 0, waivers: [], requiredDocs: [],
    eligibility: {}, approvalOffice: null, confidence: 0.9,
    formFields: [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true, options: [], source: null },
      { key: 'mayor_permit_number', label: 'Mayor’s Permit Number', type: 'text', required: true, options: [], source: null },
    ],
  })
  assert.equal(service.formFields[0].source, 'everify')
  assert.equal(service.formFields[1].source, undefined)
})
test('parses extractor HTML and infers keys/types', () => {
  const result = parseExtractionHtml('<b>Document Type</b>: Permit<br><b>Date of Birth</b>: 2000-01-01<br><b>Complete Address</b>: Marilao')
  assert.equal(result.documentTitle, 'Permit'); assert.equal(result.fields[0].key, 'date_of_birth'); assert.equal(result.fields[0].type, 'date'); assert.equal(result.fields[1].type, 'textarea')
  assert.equal(toKey('Mayor’s Permit #'), 'mayor_s_permit'); assert.equal(guessType('Annual Income', ''), 'number')
})

const template: ServiceTemplate = { id: 't', code: 'TEST', name: 'Test', description: null, max_fee: 100, created_at: '', base_fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], allowed_rules: { waiver_categories: ['student'], eligibility_keys: ['min_residency_years'], max_custom_fields: 0, typical_min_residency_years: 1 } }
const service: GeneratedService = { templateCode: 'TEST', name: 'Test', formFields: [{ key: 'custom', label: 'Custom', type: 'text', required: true }], feeAmount: 101, waivers: [{ category: 'alien', label: 'Alien', waives: 'full' }], requiredDocs: [], eligibility: { min_residency_years: 2, min_age: 18 }, approvalOffice: null, confidence: 0.5 }
test('emits all six bounded validation rules', () => {
  const rules = validateService(service, template).map((flag) => flag.ruleCode)
  assert.deepEqual(rules, ['FEE_ABOVE_TEMPLATE_CEILING','UNKNOWN_WAIVER_CATEGORY','ELIGIBILITY_KEY_NOT_ALLOWED','TOO_MANY_CUSTOM_FIELDS','ELIGIBILITY_ABOVE_TYPICAL','LOW_GENERATION_CONFIDENCE'])
})
