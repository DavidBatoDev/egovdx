import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMobile, normalizeSms, issuedSmsBody } from './emessage'
import { normalizePayment } from './pay'

test('normalizes supported Philippine mobile forms to E.164', () => {
  for (const input of ['09171234567', '9171234567', '639171234567', '+639171234567']) {
    assert.equal(normalizeMobile(input), '+639171234567')
  }
  assert.throws(() => normalizeMobile('12345'))
})

test('normalizes payment creation and status payloads', () => {
  const payment = normalizePayment({ data: { uuid: 'pay-1', txnid: 'request-1', amount: '150.00', payment_status: 'INITIAL', url: 'https://pay.test/1', channel: { refno: 'REF-1' } } }, { uuid: '', transactionId: '', amount: 0 })
  assert.deepEqual(payment, { uuid: 'pay-1', transactionId: 'request-1', referenceNumber: 'REF-1', checkoutUrl: 'https://pay.test/1', amount: 150, status: 'pending' })
  assert.equal(normalizePayment({ data: { payment_status: 'COMPLETED' } }, { uuid: 'pay-1', transactionId: 'request-1', amount: 150 }).status, 'paid')
})

test('normalizes SMS acceptance and keeps the issued message useful', () => {
  assert.deepEqual(normalizeSms({ data: { message: 'SMS was successfully created.', id: 'sms-1' } }), { messageId: 'sms-1', accepted: true })
  const body = issuedSmsBody('Barangay Clearance', 'BRGY-2026-000001', 'https://example.test/verify/1')
  assert.match(body, /BRGY-2026-000001/)
  assert.match(body, /https:\/\/example\.test\/verify\/1/)
})

