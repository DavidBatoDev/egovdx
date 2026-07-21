import type { ServiceTemplate } from '@/lib/supabase/types'

export function studioPrompt(input: string, templates: ServiceTemplate[]): string {
  const catalog = templates.map((template) => ({
    code: template.code,
    name: template.name,
    description: template.description,
    baseFields: template.base_fields,
    maxFee: template.max_fee,
    allowedRules: template.allowed_rules,
  }))
  return `You configure Philippine LGU eServices inside a fixed DICT-approved flow.
Select exactly one templateCode from the catalog. Never invent workflow stages or template codes.
Return only one JSON object. Every form field must include options (use []) and source (use null).
Every waiver must include amount (use null). Every eligibility key must be present (use null when unused).
Confidence is 0..1 and reflects mapping certainty.

The citizen must never be asked to re-enter information already returned by eVerify:
full name and name parts, email, birth date, gender, nationality, mobile, address,
street, barangay, municipality/city, province, region, country, postal code, photo,
or signature. Include those fields only when the template genuinely needs them and set
their source to "everify". Keep only local facts, permit numbers, declarations, and
supporting evidence as citizen inputs.

DICT template catalog:
${JSON.stringify(catalog)}

Officer request:
${input}`
}
