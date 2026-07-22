import 'server-only'
import type { EgovSource } from '@/lib/egov/client'
import type { EgovProfile } from '@/lib/egov/sso'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Officer, OfficerRole } from '@/lib/supabase/types'
import type { SessionRole } from './session'
import { testIdentityRole } from './egov-role-policy'

type OfficerDirectoryRow = Pick<
  Officer,
  'id' | 'egov_sub' | 'lgu_id' | 'full_name' | 'role' | 'sso_email' | 'sso_birthdate'
>

export type SsoRoleResolution = {
  role: SessionRole
  officer: OfficerDirectoryRow | null
  source: 'test-override' | 'egov-sub' | 'profile-bind' | 'citizen-default'
}

export class IdentityDirectoryError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = 'IdentityDirectoryError'
  }
}

export function isMissingIdentityDirectory(error: unknown): boolean {
  return error instanceof IdentityDirectoryError && error.code === 'PGRST205'
}

/**
 * Persists the eGovPH-owned profile at login time. The app never offers a
 * profile editor; a later SSO authentication is the only update path.
 */
export async function syncEgovIdentity(profile: EgovProfile, source: EgovSource): Promise<void> {
  const { error } = await supabaseAdmin().from('egov_identities').upsert(
    {
      egov_sub: profile.sub,
      full_name: profile.fullName,
      first_name: profile.firstName,
      middle_name: profile.middleName,
      last_name: profile.lastName,
      suffix: profile.suffix || null,
      birthdate: profile.birthDate || null,
      address: profile.address || null,
      email: normalizeEmail(profile.email),
      mobile: profile.mobile,
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'egov_sub' },
  )

  if (error) throw new IdentityDirectoryError(`Could not sync eGovPH identity: ${error.message}`, error.code)
}

/**
 * SSO authenticates the person. This function authorizes officer/reviewer
 * access from the server directory, with the explicit opt-in test identities
 * taking precedence for the eGovPH sandbox integration.
 */
export async function resolveSsoRole(profile: EgovProfile): Promise<SsoRoleResolution> {
  const override = testIdentityRole(profile)
  const bySub = await officerBySub(profile.sub)

  if (override) {
    let officer = bySub
    if (override === 'officer' && !officer) {
      const preProvisioned = await officerByProfile(profile)
      officer = preProvisioned
        ? await bindOfficer(preProvisioned.id, profile)
        : await createTestOfficer(profile)
    }
    return { role: override, officer, source: 'test-override' }
  }

  if (bySub) return { role: bySub.role, officer: bySub, source: 'egov-sub' }

  const unboundOfficer = await officerByProfile(profile)
  if (unboundOfficer) {
    const officer = await bindOfficer(unboundOfficer.id, profile)
    return { role: officer.role, officer, source: 'profile-bind' }
  }

  return { role: 'citizen', officer: null, source: 'citizen-default' }
}

async function officerBySub(sub: string): Promise<OfficerDirectoryRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('officers')
    .select('id, egov_sub, lgu_id, full_name, role, sso_email, sso_birthdate')
    .eq('egov_sub', sub)
    .maybeSingle()
  if (error) throw new Error(`Could not read officer directory: ${error.message}`)
  return data
}

async function officerByProfile(profile: EgovProfile): Promise<OfficerDirectoryRow | null> {
  const email = normalizeEmail(profile.email)
  if (!email || !profile.birthDate) return null

  const { data, error } = await supabaseAdmin()
    .from('officers')
    .select('id, egov_sub, lgu_id, full_name, role, sso_email, sso_birthdate')
    .is('egov_sub', null)
    .ilike('sso_email', email)
    .eq('sso_birthdate', profile.birthDate)
    .maybeSingle()
  if (error) throw new Error(`Could not match officer profile: ${error.message}`)
  return data
}

async function bindOfficer(id: string, profile: EgovProfile): Promise<OfficerDirectoryRow> {
  const { data, error } = await supabaseAdmin()
    .from('officers')
    .update({
      egov_sub: profile.sub,
      sso_email: normalizeEmail(profile.email),
      sso_birthdate: profile.birthDate || null,
    })
    .eq('id', id)
    .select('id, egov_sub, lgu_id, full_name, role, sso_email, sso_birthdate')
    .single()
  if (error) throw new Error(`Could not bind officer to eGovPH identity: ${error.message}`)
  return data
}

async function createTestOfficer(profile: EgovProfile): Promise<OfficerDirectoryRow> {
  const db = supabaseAdmin()
  const { error } = await db.from('officers').upsert(
    {
      egov_sub: profile.sub,
      lgu_id: null,
      full_name: profile.fullName,
      position: null,
      office: null,
      role: 'officer' satisfies OfficerRole,
      sso_email: normalizeEmail(profile.email),
      sso_birthdate: profile.birthDate || null,
    },
    { onConflict: 'egov_sub', ignoreDuplicates: true },
  )
  if (error) throw new Error(`Could not register test officer: ${error.message}`)

  const officer = await officerBySub(profile.sub)
  if (!officer) throw new Error('Test officer registration did not create a directory record')
  return officer
}

function normalizeEmail(value: string | null): string | null {
  const email = value?.trim().toLocaleLowerCase('en-US') ?? ''
  return email || null
}
