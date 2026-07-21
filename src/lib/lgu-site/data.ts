import 'server-only'

import { DEFAULT_LGU_SITE_CONFIG, parseLguSiteConfig, type LguSiteConfig } from './schema'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Lgu, LguSiteConfigRow } from '@/lib/supabase/types'

export type LguSiteEditorState = {
  config: LguSiteConfig
  revision: number
  publishedRevision: number | null
  publishedAt: string | null
}

export async function getLguSiteEditorState(lguId: string): Promise<LguSiteEditorState> {
  const { data, error } = await supabaseAdmin().from('lgu_site_configs').select('*').eq('lgu_id', lguId).maybeSingle()
  if (error) throw new Error(`getLguSiteEditorState: ${error.message}`)
  return data ? {
    config: parseLguSiteConfig(data.draft_config),
    revision: data.draft_revision,
    publishedRevision: data.published_revision,
    publishedAt: data.published_at,
  } : { config: DEFAULT_LGU_SITE_CONFIG, revision: 0, publishedRevision: null, publishedAt: null }
}

async function validateOwnedReferences(lguId: string, config: LguSiteConfig) {
  const mediaPaths = new Set([config.branding.logoPath, ...config.banners.map((banner) => banner.imagePath)].filter((path): path is string => Boolean(path)))
  if (mediaPaths.size) {
    const { data, error } = await supabaseAdmin().from('lgu_site_media').select('storage_path').eq('lgu_id', lguId).in('storage_path', [...mediaPaths])
    if (error) throw new Error(error.message)
    if ((data ?? []).length !== mediaPaths.size) throw new Error('CMS_MEDIA_NOT_OWNED')
  }

  const serviceIds = [...new Set([
    ...config.banners.map((banner) => banner.target),
    ...config.quickLinks.map((link) => link.target),
  ].filter((target) => target?.type === 'service').map((target) => target!.type === 'service' ? target!.serviceId : ''))]
  if (serviceIds.length) {
    const { data, error } = await supabaseAdmin().from('lgu_services').select('id').eq('lgu_id', lguId).eq('status', 'published').in('id', serviceIds)
    if (error) throw new Error(error.message)
    if ((data ?? []).length !== serviceIds.length) throw new Error('CMS_SERVICE_NOT_PUBLISHED')
  }
}

export async function saveLguSiteDraft(lguId: string, officerSub: string, value: unknown, expectedRevision: number) {
  const config = parseLguSiteConfig(value)
  await validateOwnedReferences(lguId, config)
  const db = supabaseAdmin()
  if (expectedRevision === 0) {
    const insert: LguSiteConfigRow = {
      lgu_id: lguId, draft_config: config, published_config: null, draft_revision: 1,
      published_revision: null, updated_by: officerSub, updated_at: new Date().toISOString(), published_by: null, published_at: null,
    }
    const { data, error } = await db.from('lgu_site_configs').insert(insert).select('*').maybeSingle()
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error('CMS_REVISION_CONFLICT')
      throw new Error(error.message)
    }
    return data!
  }

  const { data, error } = await db.from('lgu_site_configs').update({
    draft_config: config,
    draft_revision: expectedRevision + 1,
    updated_by: officerSub,
    updated_at: new Date().toISOString(),
  }).eq('lgu_id', lguId).eq('draft_revision', expectedRevision).select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('CMS_REVISION_CONFLICT')
  return data
}

export async function publishLguSite(lguId: string, officerSub: string, expectedRevision: number) {
  const state = await getLguSiteEditorState(lguId)
  if (state.revision !== expectedRevision || expectedRevision === 0) throw new Error('CMS_REVISION_CONFLICT')
  await validateOwnedReferences(lguId, state.config)
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin().from('lgu_site_configs').update({
    published_config: state.config,
    published_revision: expectedRevision,
    published_by: officerSub,
    published_at: now,
  }).eq('lgu_id', lguId).eq('draft_revision', expectedRevision).select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('CMS_REVISION_CONFLICT')
  return data
}

export async function getPublishedLguSite(lguId: string): Promise<{ lgu: Pick<Lgu, 'id' | 'name' | 'type'>; config: LguSiteConfig; publishedAt: string } | null> {
  const { data, error } = await supabaseAdmin().from('lgu_site_configs').select('published_config,published_at,lgu:lgus!inner(id,name,type)').eq('lgu_id', lguId).not('published_config', 'is', null).maybeSingle()
  if (error) throw new Error(`getPublishedLguSite: ${error.message}`)
  if (!data?.published_config || !data.published_at) return null
  return { lgu: data.lgu as unknown as Pick<Lgu, 'id' | 'name' | 'type'>, config: parseLguSiteConfig(data.published_config), publishedAt: data.published_at }
}

export async function listPublishedLguSites() {
  const { data, error } = await supabaseAdmin().from('lgu_site_configs').select('lgu_id,published_config,lgu:lgus!inner(id,name,type)').not('published_config', 'is', null)
  if (error) throw new Error(`listPublishedLguSites: ${error.message}`)
  return (data ?? []).map((row) => ({ lgu: row.lgu as unknown as Pick<Lgu, 'id' | 'name' | 'type'>, config: parseLguSiteConfig(row.published_config) }))
}

export function configReferencesPath(config: LguSiteConfig | null, path: string) {
  return Boolean(config && (config.branding.logoPath === path || config.banners.some((banner) => banner.imagePath === path)))
}
