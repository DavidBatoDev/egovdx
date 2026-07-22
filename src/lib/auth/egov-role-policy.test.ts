import assert from 'node:assert/strict'
import test from 'node:test'
import type { EgovProfile } from '@/lib/egov/sso'
import { testIdentityRole } from './egov-role-policy'

function profile(email: string, fullName: string): Pick<EgovProfile, 'email' | 'fullName'> {
  return { email, fullName }
}

test('maps the supplied eGovPH test identities to the agreed roles', () => {
  assert.equal(testIdentityRole(profile('josie@yopmail.com', 'Josie Santos Dela Cruz'), true), 'citizen')
  assert.equal(testIdentityRole(profile('josie01@yopmail.com', 'JOSE CRUZ DELA PENA III'), true), 'citizen')
  assert.equal(testIdentityRole(profile('josie02@yopmail.com', 'Arnel Dela Cruz II'), true), 'citizen')
  assert.equal(testIdentityRole(profile('josie03@yopmail.com', 'John Garcia Reyes Jr.'), true), 'officer')
  assert.equal(testIdentityRole(profile('josie04@yopmail.com', 'Josielyn Ramos Mendoza'), true), 'officer')
})

test('requires an explicit opt-in and both identity fields', () => {
  assert.equal(testIdentityRole(profile('josie03@yopmail.com', 'John Garcia Reyes Jr.'), false), null)
  assert.equal(testIdentityRole(profile('josie03@yopmail.com', 'Different Person'), true), null)
  assert.equal(testIdentityRole(profile('other@example.test', 'John Garcia Reyes Jr.'), true), null)
})
