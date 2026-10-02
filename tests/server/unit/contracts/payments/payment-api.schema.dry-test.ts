import assert from 'node:assert/strict'
import { paymentApiContract, paymentCreateSchema, paymentMethodSchema, paymentResponseSchema } from '../../../../../contracts/payments/payment-api.schema.js'

const body = { invoiceNumber: '  INV-1  ', amount: -25, method: 'BANK_TRANSFER' }
assert.deepEqual(paymentCreateSchema.parse(body), {
  invoiceNumber: 'INV-1', amount: -25, method: 'BANK_TRANSFER',
  reference: null, proofUrl: null, notes: null,
})
assert.deepEqual(paymentCreateSchema.parse({
  ...body,
  paidAt: '2026-10-02 12:34:56',
  reference: '  ref  ', proofUrl: '  https://example.com/slip  ', notes: '   ',
}), {
  invoiceNumber: 'INV-1', amount: -25, method: 'BANK_TRANSFER',
  paidAt: '2026-10-02 12:34:56',
  reference: 'ref', proofUrl: 'https://example.com/slip', notes: null,
})
// The web client validates with this schema and sends its output; the server must accept it.
const clientOutput = paymentCreateSchema.parse(body)
assert.deepEqual(paymentCreateSchema.parse(JSON.parse(JSON.stringify(clientOutput))), clientOutput)
assert.deepEqual(paymentMethodSchema.options, [
  'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'QR_PROMPTPAY', 'GIFT_VOUCHER', 'OTHER',
])
for (const invalid of [
  { ...body, amount: 0 },
  { ...body, method: 'CARD' },
  { ...body, invoiceNumber: '  ' },
  { ...body, amount: '25' },
  { ...body, paidAt: '2026-10-02T12:34:56Z' },
  { ...body, status: 'PENDING' },
  { ...body, createdBy: 'staff' },
]) {
  assert.equal(paymentCreateSchema.safeParse(invalid).success, false, JSON.stringify(invalid))
}
assert.equal(paymentApiContract.request.create, paymentCreateSchema)
assert.equal(paymentApiContract.response.create, paymentResponseSchema)
assert.equal('detail' in paymentApiContract.response, false)
assert.equal('update' in paymentApiContract.response, true)

console.log('payment-api.schema.dry-test: OK')
