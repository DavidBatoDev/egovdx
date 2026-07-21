import 'server-only'
import { supabaseAdmin } from './supabase/server'
import type {
  Lgu,
  LguService,
  ServiceTemplate,
  ValidationFlag,
  ServiceRequest,
  RequestEvent,
} from './supabase/types'

/**
 * Query helpers shared by pages and route handlers.
 *
 * Kept deliberately thin — these are joins the UI needs, not a repository
 * abstraction. Anything used exactly once stays inline at its call site.
 */

export type PublishedService = LguService & {
  lgu: Pick<Lgu, 'id' | 'name' | 'type'>
  template: Pick<ServiceTemplate, 'id' | 'code' | 'name' | 'description' | 'max_fee'>
}

const SERVICE_JOIN =
  '*, lgu:lgus!inner(id,name,type), template:service_templates!inner(id,code,name,description,max_fee)'

export async function listPublishedServices(): Promise<PublishedService[]> {
  const { data, error } = await supabaseAdmin()
    .from('lgu_services')
    .select(SERVICE_JOIN)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listPublishedServices: ${error.message}`)
  return (data ?? []) as unknown as PublishedService[]
}

export async function getService(id: string): Promise<PublishedService | null> {
  const { data, error } = await supabaseAdmin()
    .from('lgu_services')
    .select(SERVICE_JOIN)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getService: ${error.message}`)
  return (data as unknown as PublishedService) ?? null
}

export async function listServicesForLgu(lguId: string): Promise<PublishedService[]> {
  const { data, error } = await supabaseAdmin()
    .from('lgu_services')
    .select(SERVICE_JOIN)
    .eq('lgu_id', lguId)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listServicesForLgu: ${error.message}`)
  return (data ?? []) as unknown as PublishedService[]
}

export async function listFlagsFor(serviceIds: string[]): Promise<ValidationFlag[]> {
  if (serviceIds.length === 0) return []

  const { data, error } = await supabaseAdmin()
    .from('validation_flags')
    .select('*')
    .in('lgu_service_id', serviceIds)
    .eq('resolved', false)

  if (error) throw new Error(`listFlagsFor: ${error.message}`)
  return data ?? []
}

/** Flags grouped by service, so a list view can render counts without N queries. */
export async function flagsByService(
  serviceIds: string[],
): Promise<Map<string, ValidationFlag[]>> {
  const flags = await listFlagsFor(serviceIds)
  const map = new Map<string, ValidationFlag[]>()

  for (const flag of flags) {
    const existing = map.get(flag.lgu_service_id)
    if (existing) existing.push(flag)
    else map.set(flag.lgu_service_id, [flag])
  }

  return map
}

export type RequestWithService = ServiceRequest & {
  service: PublishedService
}

const REQUEST_JOIN = `*, service:lgu_services!inner(${SERVICE_JOIN})`

export async function getRequest(id: string): Promise<RequestWithService | null> {
  const { data, error } = await supabaseAdmin()
    .from('requests')
    .select(REQUEST_JOIN)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getRequest: ${error.message}`)
  return (data as unknown as RequestWithService) ?? null
}

export async function getRequestByHash(hash: string): Promise<RequestWithService | null> {
  const { data, error } = await supabaseAdmin()
    .from('requests')
    .select(REQUEST_JOIN)
    .eq('doc_hash', hash)
    .maybeSingle()

  if (error) throw new Error(`getRequestByHash: ${error.message}`)
  return (data as unknown as RequestWithService) ?? null
}

export async function listRequestsForLgu(lguId: string): Promise<RequestWithService[]> {
  const { data: serviceRows, error: serviceError } = await supabaseAdmin().from('lgu_services').select('id').eq('lgu_id', lguId)
  if (serviceError) throw new Error(`listRequestsForLgu: ${serviceError.message}`)
  const ids = (serviceRows ?? []).map((service) => service.id)
  if (ids.length === 0) return []

  const { data, error } = await supabaseAdmin()
    .from('requests')
    .select(REQUEST_JOIN)
    .in('lgu_service_id', ids)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listRequestsForLgu: ${error.message}`)
  return (data ?? []) as unknown as RequestWithService[]
}

export async function listRequestsForCitizen(citizenSub: string): Promise<RequestWithService[]> {
  const { data, error } = await supabaseAdmin().from('requests').select(REQUEST_JOIN).eq('citizen_sub', citizenSub).order('created_at', { ascending: false })
  if (error) throw new Error(`listRequestsForCitizen: ${error.message}`)
  return (data ?? []) as unknown as RequestWithService[]
}

export async function listEvents(requestId: string): Promise<RequestEvent[]> {
  const { data, error } = await supabaseAdmin()
    .from('request_events')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listEvents: ${error.message}`)
  return data ?? []
}

/**
 * Append to the audit trail.
 *
 * Never throws: an audit write failing should not roll back the citizen-facing
 * action that succeeded. It logs loudly instead.
 */
export async function recordEvent(
  requestId: string,
  actor: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('request_events')
    .insert({ request_id: requestId, actor, event, payload })

  if (error) console.error(`[audit] failed to record ${event}: ${error.message}`)
}
