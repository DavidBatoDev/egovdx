import assert from 'node:assert/strict'
import test from 'node:test'
import { safeNextForRole } from './state'

test('officer destinations stay in the LGU namespace', () => {
  assert.equal(safeNextForRole('/lgu/municipal/marilao', 'officer', '/lgu'), '/lgu/municipal/marilao')
  assert.equal(safeNextForRole('/console', 'officer', '/lgu'), '/lgu')
  assert.equal(safeNextForRole('/console/studio', 'officer', '/lgu'), '/lgu')
  assert.equal(safeNextForRole('/citizen/services', 'officer', '/lgu'), '/lgu')
})

test('citizen and reviewer destinations cannot cross role namespaces', () => {
  assert.equal(safeNextForRole('/citizen/services', 'citizen', '/citizen/services'), '/citizen/services')
  assert.equal(safeNextForRole('/lgu', 'citizen', '/citizen/services'), '/citizen/services')
  assert.equal(safeNextForRole('/review', 'reviewer', '/review'), '/review')
  assert.equal(safeNextForRole('/console', 'reviewer', '/review'), '/review')
})

test('external and protocol-relative redirects are rejected', () => {
  assert.equal(safeNextForRole('https://example.com', 'officer', '/lgu'), '/lgu')
  assert.equal(safeNextForRole('//example.com', 'citizen', '/citizen/services'), '/citizen/services')
})
