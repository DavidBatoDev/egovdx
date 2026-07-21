import type { GeneratedService } from '@/lib/studio/generate'
import type { LguService, ServiceTemplate } from '@/lib/supabase/types'

export type ServiceValidationFlag = {
  ruleCode: string
  severity: 'warn' | 'block'
  message: string
  fieldPath: string | null
}

export function validateService(
  service: GeneratedService | LguService,
  template: ServiceTemplate,
): ServiceValidationFlag[] {
  const fee = 'feeAmount' in service ? service.feeAmount : service.fee_amount
  const fields = 'formFields' in service ? service.formFields : service.form_fields
  const confidence = 'confidence' in service ? service.confidence : service.generation_confidence
  const flags: ServiceValidationFlag[] = []
  if (template.max_fee != null && fee > template.max_fee) {
    flags.push({ ruleCode: 'FEE_ABOVE_TEMPLATE_CEILING', severity: 'block', message: `Fee ₱${fee} exceeds the ₱${template.max_fee} template ceiling.`, fieldPath: 'feeAmount' })
  }
  const allowedWaivers = new Set(template.allowed_rules.waiver_categories ?? [])
  for (const [index, waiver] of service.waivers.entries()) {
    if (!allowedWaivers.has(waiver.category)) flags.push({ ruleCode: 'UNKNOWN_WAIVER_CATEGORY', severity: 'block', message: `Waiver category “${waiver.category}” is not approved for this template.`, fieldPath: `waivers.${index}.category` })
  }
  const allowedEligibility = new Set(template.allowed_rules.eligibility_keys ?? [])
  for (const key of Object.keys(service.eligibility)) {
    if (!allowedEligibility.has(key)) flags.push({ ruleCode: 'ELIGIBILITY_KEY_NOT_ALLOWED', severity: 'block', message: `Eligibility rule “${key}” is not allowed for this template.`, fieldPath: `eligibility.${key}` })
  }
  const baseKeys = new Set(template.base_fields.map((field) => field.key))
  const customCount = fields.filter((field) => !baseKeys.has(field.key)).length
  const maxCustom = template.allowed_rules.max_custom_fields ?? 0
  if (customCount > maxCustom) flags.push({ ruleCode: 'TOO_MANY_CUSTOM_FIELDS', severity: 'warn', message: `${customCount} custom fields exceeds the recommended maximum of ${maxCustom}.`, fieldPath: 'formFields' })
  const typical = template.allowed_rules.typical_min_residency_years ?? 1
  if ((service.eligibility.min_residency_years ?? 0) > typical) flags.push({ ruleCode: 'ELIGIBILITY_ABOVE_TYPICAL', severity: 'warn', message: `Residency requirement is above the national norm of ${typical} year(s).`, fieldPath: 'eligibility.min_residency_years' })
  if (confidence != null && confidence < 0.7) flags.push({ ruleCode: 'LOW_GENERATION_CONFIDENCE', severity: 'warn', message: `Generation confidence ${Math.round(confidence * 100)}% is below the 70% review threshold.`, fieldPath: 'generationConfidence' })
  return flags
}
