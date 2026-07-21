import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/server'
import type { LguType } from '@/lib/supabase/types'

export type LguUrlKind = 'municipal' | 'city'

export type OfficerLguScope = {
  lguId: string
  lguName: string
  lguType: LguType
  kind: LguUrlKind
  municipalityName: string
  municipalitySlug: string
  barangayName: string | null
  barangaySlug: string | null
  canonicalBase: string
}

function withoutAdministrativeLabel(name: string, type: LguType): string {
  let value = name.trim()
  if (type === 'barangay') value = value.replace(/^barangay\s+/i, '')
  if (type === 'city') value = value.replace(/^city\s+of\s+/i, '').replace(/\s+city$/i, '')
  if (type === 'municipality') value = value.replace(/^municipality\s+of\s+/i, '')
  return value.trim()
}

export function lguNameSlug(name: string, type: LguType): string {
  return withoutAdministrativeLabel(name, type)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function getOfficerLguScope(lguId: string): Promise<OfficerLguScope> {
  const db = supabaseAdmin()
  const { data: lgu, error } = await db
    .from('lgus')
    .select('id, name, type, parent_id, psgc_code')
    .eq('id', lguId)
    .maybeSingle()

  if (error) throw new Error(`getOfficerLguScope: ${error.message}`)
  if (!lgu) throw new Error('LGU_NOT_FOUND')

  if (lgu.type !== 'barangay') {
    const kind: LguUrlKind = lgu.type === 'city' ? 'city' : 'municipal'
    const municipalityName = withoutAdministrativeLabel(lgu.name, lgu.type)
    const municipalitySlug = lguNameSlug(lgu.name, lgu.type)
    return {
      lguId: lgu.id,
      lguName: lgu.name,
      lguType: lgu.type,
      kind,
      municipalityName,
      municipalitySlug,
      barangayName: null,
      barangaySlug: null,
      canonicalBase: `/lgu/${kind}/${municipalitySlug}`,
    }
  }

  let parent: { name: string; type: 'city' | 'municipality' } | null = null
  if (lgu.psgc_code) {
    const { data: barangayReference } = await db
      .from('psgc_reference')
      .select('parent_code')
      .eq('code', lgu.psgc_code)
      .maybeSingle()
    if (barangayReference?.parent_code) {
      const { data: parentReference } = await db
        .from('psgc_reference')
        .select('name, level')
        .eq('code', barangayReference.parent_code)
        .maybeSingle()
      if (parentReference?.level === 'city' || parentReference?.level === 'municipality') {
        parent = { name: parentReference.name, type: parentReference.level }
      }
    }
  }

  if (!parent && lgu.parent_id) {
    const { data: registeredParent } = await db
      .from('lgus')
      .select('name, type')
      .eq('id', lgu.parent_id)
      .maybeSingle()
    if (registeredParent?.type === 'city' || registeredParent?.type === 'municipality') {
      parent = { name: registeredParent.name, type: registeredParent.type }
    }
  }

  if (!parent) throw new Error('LGU_PARENT_UNRESOLVED')

  const kind: LguUrlKind = parent.type === 'city' ? 'city' : 'municipal'
  const municipalityName = withoutAdministrativeLabel(parent.name, parent.type)
  const municipalitySlug = lguNameSlug(parent.name, parent.type)
  const barangayName = withoutAdministrativeLabel(lgu.name, 'barangay')
  const barangaySlug = lguNameSlug(lgu.name, 'barangay')
  const canonicalBase = `/lgu/${kind}/${municipalitySlug}/brgy/${barangaySlug}`

  return {
    lguId: lgu.id,
    lguName: lgu.name,
    lguType: lgu.type,
    kind,
    municipalityName,
    municipalitySlug,
    barangayName,
    barangaySlug,
    canonicalBase,
  }
}
