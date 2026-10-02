import assert from 'node:assert/strict'
import type { z } from 'zod'
import { PaymentService, paymentRoutes } from '../../../../../server/modules/payments/payment.module.js'
import { paymentApiContract } from '../../../../../contracts/payments/payment-api.schema.js'
import { resolveRoute } from '../../../../../server/api/route-registry.js'
import { paymentsRowSchema } from '../../../../../server/sheets/Payments/Payments.db-contract.js'
import { createCrudRoutes } from '../../../../../server/shared/http/crud-routes.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

type Row = z.infer<typeof paymentsRowSchema>
const appended: Array<Partial<Row>> = []
const repository: SheetRepositoryContract<Row> = {
  async read() { return [] },
  async append(row) {
    appended.push(row)
    return row as Row
  },
  async batchAppend() { throw new Error('not used') },
  async update() { throw new Error('not used') },
  async delete() { throw new Error('not used') },
}
const service = new PaymentService({
  repository,
  now: () => new Date('2026-10-02T05:34:56Z'),
  generateId: () => 'PAY-test1234',
})

const first = await service.create({
  invoiceNumber: ' INV-1 ', amount: 500, method: 'QR_PROMPTPAY',
  proofUrl: ' https://example.com/proof.jpg ', reference: '  TX-1 ', notes: ' received ',
})
assert.deepEqual(appended[0], {
  payment_id: 'PAY-test1234', invoice_number: 'INV-1', amount: 500,
  method: 'QR_PROMPTPAY', status: 'VERIFIED', paid_at: '2026-10-02 12:34:56',
  reference: 'TX-1', proof_url: 'https://example.com/proof.jpg', notes: 'received',
  slip_data: null, created_at: '2026-10-02 12:34:56', created_by: 'admin',
  updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
})
assert.deepEqual(first, {
  paymentId: 'PAY-test1234', invoiceNumber: 'INV-1', amount: 500,
  method: 'QR_PROMPTPAY', status: 'VERIFIED', paidAt: '2026-10-02 12:34:56',
  reference: 'TX-1', proofUrl: 'https://example.com/proof.jpg', notes: 'received',
})

await service.create({
  invoiceNumber: 'INV-1', amount: -50, method: 'CASH', paidAt: '2026-10-01 11:22:33',
  proofUrl: '', reference: ' ', notes: '',
})
assert.equal(appended[1]?.status, 'VERIFIED')
assert.equal(appended[1]?.amount, -50)
assert.equal(appended[1]?.paid_at, '2026-10-01 11:22:33')
assert.equal(appended[1]?.proof_url, null)
assert.equal(appended[1]?.reference, null)
assert.equal(appended[1]?.notes, null)
assert.equal(appended[1]?.created_at, '2026-10-02 12:34:56')
const generated = await new PaymentService({ repository }).create({
  invoiceNumber: 'INV-2', amount: 1, method: 'OTHER',
})
assert.match(generated.paymentId, /^PAY-[0-9a-f]{8}$/)
assert.equal(appended[2]?.payment_id, generated.paymentId)

const routes = createCrudRoutes(service, paymentApiContract)
const created = await routes.collection.handleRequest({
  method: 'POST', query: {}, body: { invoiceNumber: 'INV-3', amount: 10, method: 'CASH' },
  headers: {}, params: {},
})
assert.equal(created.status, 201)
assert.equal((created.body as { data: { status: string } }).data.status, 'VERIFIED')
assert.deepEqual(Object.keys((created.body as { data: object }).data), [
  'paymentId', 'invoiceNumber', 'amount', 'method', 'status', 'paidAt',
  'reference', 'proofUrl', 'notes',
])
assert.equal((await resolveRoute('payments')).collection, paymentRoutes.collection)
assert.notEqual(paymentRoutes.item, undefined)
const methodNotAllowed = await paymentRoutes.collection.handleRequest({
  method: 'PATCH', query: {}, body: {}, headers: {}, params: {},
})
assert.equal(methodNotAllowed.status, 405)
assert.equal(methodNotAllowed.headers?.Allow, 'GET, POST')

console.log('payment.service.dry-test: OK')
