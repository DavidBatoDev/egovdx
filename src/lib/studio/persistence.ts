import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { GeneratedService, GenerationResult } from './generate'
import { validateService, type ServiceValidationFlag } from '@/lib/rules/validate'

export async function validateGeneratedService(service: GeneratedService) {
  const { data: template, error } = await supabaseAdmin()
    .from('service_templates')
    .select('*')
    .eq('code', service.templateCode)
    .single()
  if (error) throw error
  return { template, flags: validateService(service, template) }
}

export async function saveGeneratedService(args: {
  lguId: string
  service: GeneratedService
  generation: Pick<GenerationResult, 'engine' | 'model'>
  sourcePrompt: string | null
  generatedBy: 'ai' | 'upload'
}): Promise<{ serviceId: string; status: 'flagged' | 'published'; flags: ServiceValidationFlag[] }> {
  const { flags } = await validateGeneratedService(args.service)
  const { data, error } = await supabaseAdmin().rpc('save_generated_service', {
    p_lgu_id: args.lguId,
    p_template_code: args.service.templateCode,
    p_service: args.service as unknown as Record<string, unknown>,
    p_flags: flags as unknown as Record<string, unknown>[],
    p_source_prompt: args.sourcePrompt,
    p_generated_by: args.generatedBy,
    p_generator_model: `${args.generation.engine}:${args.generation.model}`,
  })
  if (error) throw error
  const saved = data?.[0]
  if (!saved) throw new Error('Database did not return the saved service')
  return { serviceId: saved.service_id, status: saved.status as 'flagged' | 'published', flags }
}
