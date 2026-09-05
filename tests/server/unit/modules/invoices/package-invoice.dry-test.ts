import assert from 'node:assert/strict'
import { invoiceCreateSchema } from '../../../../../contracts/invoices/invoice-api.schema.js'
import { InvoiceService } from '../../../../../server/modules/invoices/invoice.service.js'

const request = {
  billingType: 'PACKAGE', invoiceNumber: 'INV-PACKAGE-TEST',
  issuedDate: '2026-09-05', dueDate: '2026-09-08',
  customer: { customerCode: 'CUS-1', customerName: 'Customer' },
  adjustments: [], items: [{ description: 'Package', quantity: 1, unitPrice: 500, adjustments: [] }],
}
assert.equal(invoiceCreateSchema.safeParse(request).success, true)
assert.equal(invoiceCreateSchema.safeParse({ ...request, sourceOrderId: 'ORD-1' }).success, false)
assert.equal(invoiceCreateSchema.safeParse({ ...request, billingType: 'ORDER' }).success, false)
assert.equal(invoiceCreateSchema.safeParse({ ...request, billingType: 'ORDER', sourceOrderId: 'ORD-1' }).success, true)

const calls: string[] = []
const service = new InvoiceService({
  invoiceRepository: () => ({
    async read() { return [] },
    async append(row) {
      calls.push('invoice')
      assert.equal(row.billing_type, 'PACKAGE')
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
