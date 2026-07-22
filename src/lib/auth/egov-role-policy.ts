import type { SessionRole } from './session'
import type { EgovProfile } from '@/lib/egov/sso'

type TestIdentity = {
  emails: readonly string[]
  fullName: string
  role: Extract<SessionRole, 'citizen' | 'officer'>
}

/**
 * Explicitly opt-in integration identities supplied by eGovPH. These are not
 * a general authorization mechanism: normal live users are authorized by the
 * officer directory, while everyone else is a citizen.
 */
const TEST_IDENTITIES: readonly TestIdentity[] = [
  { emails: ['josie@yopmail.com'], fullName: 'JOSIE SANTOS DELA CRUZ', role: 'citizen' },
  { emails: ['josie01@yopmail.com', 'josieo1@yopmail.com'], fullName: 'JOSE CRUZ DELA PENA III', role: 'citizen' },
  { emails: ['josie02@yopmail.com', 'josieo2@yopmail.com'], fullName: 'ARNEL DELA CRUZ II', role: 'citizen' },
  { emails: ['josie03@yopmail.com', 'josieo3@yopmail.com'], fullName: 'JOHN GARCIA REYES JR', role: 'officer' },
  { emails: ['josie04@yopmail.com', 'josieo4@yopmail.com'], fullName: 'JOSIELYN RAMOS MENDOZA', role: 'officer' },
]

export function testIdentityRoleOverridesEnabled(): boolean {
  return process.env.EGOV_SSO_TEST_ROLE_OVERRIDES === 'enabled'
}

/**
 * Returns a role only when both eGovPH identifiers match a declared test
 * account. Email alone must never grant an officer role.
 */
export function testIdentityRole(
  profile: Pick<EgovProfile, 'email' | 'fullName'>,
  enabled = testIdentityRoleOverridesEnabled(),
): Extract<SessionRole, 'citizen' | 'officer'> | null {
  if (!enabled || !profile.email) return null

  const email = normalizeEmail(profile.email)
  const fullName = normalizeName(profile.fullName)
  const match = TEST_IDENTITIES.find(
    (identity) => identity.emails.some((candidate) => normalizeEmail(candidate) === email)
      && normalizeName(identity.fullName) === fullName,
  )
  return match?.role ?? null
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
