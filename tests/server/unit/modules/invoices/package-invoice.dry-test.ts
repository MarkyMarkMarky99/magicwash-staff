import assert from 'node:assert/strict'
import { invoiceCreateSchema } from '../../../../../contracts/invoices/invoice-api.schema.js'
import { InvoiceService } from '../../../../../server/modules/invoices/invoice.service.js'

// A package purchase is billed as a CYCLE invoice whose period is the
// package's own start and expiry dates. There is no PACKAGE billing type:
// billingType only says how many orders an invoice covers.
const request = {
  billingType: 'CYCLE', invoiceNumber: 'INV-PACKAGE-TEST',
  billingPeriodStart: '2026-09-05', billingPeriodEnd: '2026-10-05',
  issuedDate: '2026-09-05', dueDate: '2026-09-08',
  customer: { customerCode: 'CUS-1', customerName: 'Customer' },
  adjustments: [], items: [{ description: 'Package', quantity: 1, unitPrice: 500, adjustments: [] }],
}
assert.equal(invoiceCreateSchema.safeParse(request).success, true)
assert.equal(invoiceCreateSchema.safeParse({ ...request, sourceOrderId: 'ORD-1' }).success, false)
assert.equal(invoiceCreateSchema.safeParse({ ...request, billingType: 'ORDER' }).success, false)
// A CYCLE invoice without its period is rejected — the registry requires it.
const { billingPeriodStart: _s, billingPeriodEnd: _e, ...noPeriod } = request
assert.equal(invoiceCreateSchema.safeParse(noPeriod).success, false)
// PACKAGE is not a billing type any more.
assert.equal(invoiceCreateSchema.safeParse({ ...request, billingType: 'PACKAGE' }).success, false)
const { billingPeriodStart: _s2, billingPeriodEnd: _e2, ...orderReq } = request
assert.equal(invoiceCreateSchema.safeParse({ ...orderReq, billingType: 'ORDER', sourceOrderId: 'ORD-1' }).success, true)

const calls: string[] = []
const service = new InvoiceService({
  invoiceRepository: () => ({
    async read() { return [] },
    async append(row) {
      calls.push('invoice')
      assert.equal(row.billing_type, 'CYCLE')
      assert.equal(row.billing_period_start, '2026-09-05')
      assert.equal(row.billing_period_end, '2026-10-05')
      assert.equal(row.customer_id, 'CUS-1')
      return row
    },
    async update(_id, row) { return row },
  }),
  invoiceItemRepository: () => ({
    async batchAppend(rows) {
      calls.push('items')
      assert.equal(rows.length, 1)
      assert.equal(rows[0].source_order_id, null)
      assert.equal(rows[0].net_total, 500)
      return rows
    },
  }),
  orderFormRepository: () => { throw new Error('Package invoices must not access OrderForm') },
  invoiceViewRepository: { async read() { return [] } },
  syncInvoiceView: async () => { calls.push('view'); return { outcome: 'confirmed' } },
  generateItemId: () => '12345678',
})
const result = await service.create(request)
assert.equal(result.kind, 'created')
assert.deepEqual(calls, ['items', 'invoice', 'view'])
if (result.kind === 'created') assert.equal(result.invoiceTotal, 500)
console.log('Package invoice validation, write sequence, totals and no-order-link checks passed')
