import assert from 'node:assert/strict'
import { InvoiceService } from '../../../../../server/modules/invoices/invoice.service.js'

let owner = 'customer'
let existingStatus = 'VOID'
let orderInvoiceId: string | null = null
let legacyLine = false
let sourcedLine = true
let existingSku: string | null = null
let savedItems: Array<Record<string, unknown>> = []
const reads: Array<{ sheet: string; where: Record<string, unknown> | undefined }> = []
function readRows<T extends Record<string, unknown>>(sheet: string, source: T[], query?: { where?: Record<string, unknown> }): T[] {
  reads.push({ sheet, where: query?.where })
  return source.filter((row) => Object.entries(query?.where ?? {}).every(([key, value]) => row[key] === value))
}
const service = new InvoiceService({
  invoiceRepository: () => ({
    async read(query) { return readRows('invoices', [{ invoice_number: 'INV260900000001', billing_type: 'ORDER', status: existingStatus as never }], query) },
    async append(row) { return row }, async update(_id, row) { return row },
  }),
  invoiceItemRepository: () => ({ async batchAppend(rows) { savedItems = rows; return rows } }),
  invoiceItemReader: () => ({ async read(query) { return readRows('invoiceItems', [
    ...(sourcedLine ? [{ invoice_number: 'INV260900000001', source_order_id: 'order-1', source_item_id: 'item-1' }] : []),
    ...(legacyLine ? [{ invoice_number: 'INV260900000001', source_order_id: 'order-1', source_item_id: null }] : []),
    ...(existingSku ? [{ invoice_number: 'INV260900000001', sku: existingSku }] : []),
  ], query) } }),
  orderFormRepository: () => ({ async update(_id, row) { return row } }),
  orderFormReader: () => ({ async read(query: { where?: Record<string, unknown> }) { return readRows('orders', [{ id: 'order-1', customer_id: owner, service_type: 'WASH', invoice_id: orderInvoiceId }], query) } }) as never,
  orderItemPort: { async listByOrderId(orderId) { return readRows('orderItems', Array.from({ length: 20 }, (_, index) => ({ id: `item-${index + 1}`, order_id: 'order-1' })), { where: { order_id: orderId } })
    .map((row) => ({ orderItemId: row.id, orderId: row.order_id })) as never } },
  paymentRepository: () => ({ async read() { return [] } }),
  syncInvoiceView: async () => ({ outcome: 'confirmed' }),
})
const request = {
  billingType: 'CYCLE', invoiceNumber: 'INV260900000002', billingPeriodStart: '2026-09-01', billingPeriodEnd: '2026-09-30',
  issuedDate: '2026-09-30', dueDate: '2026-10-03', customer: { customerCode: 'customer', customerName: 'Test' },
  adjustments: [], items: [{ description: 'Suit', quantity: 1, unit: 'piece', unitPrice: 180, adjustments: [],
    sourceOrderId: 'order-1', sourceItemId: 'item-1', serviceType: 'WASH' }],
} as const

owner = 'someone-else'
assert.equal((await service.create(request)).kind, 'validation_error')
owner = 'customer'
existingStatus = 'ISSUED'
assert.equal((await service.create(request)).kind, 'validation_error')
existingStatus = 'VOID'
assert.equal((await service.create(request)).kind, 'created')
assert.equal(savedItems[0]?.source_order_id, 'order-1')
assert.equal(savedItems[0]?.source_item_id, 'item-1')
assert.equal(savedItems[0]?.service_type, 'WASH')
assert.ok(reads.some((read) => read.sheet === 'orderItems' && read.where?.order_id === 'order-1'))
assert.ok(reads.some((read) => read.sheet === 'invoiceItems' && read.where?.source_order_id === 'order-1'))
assert.ok(reads.filter((read) => read.sheet !== 'invoices').every((read) => read.where && Object.keys(read.where).length > 0))
assert.ok(reads.filter((read) => read.sheet === 'invoices').every((read) => !read.where))
const readsBeforeMany = reads.length
const manyItems = Array.from({ length: 20 }, (_, index) => ({ ...request.items[0], sourceItemId: `item-${index + 1}` }))
assert.equal((await service.create({ ...request, invoiceNumber: 'INV260900000005', items: manyItems })).kind, 'created')
assert.deepEqual(reads.slice(readsBeforeMany).map((read) => read.sheet).sort(), ['invoiceItems', 'invoices', 'orderItems', 'orders'])
existingStatus = 'ISSUED'
orderInvoiceId = 'INV260900000001'
const secondItem = { ...request, invoiceNumber: 'INV260900000006', items: [{ ...request.items[0], description: 'Coat', unitPrice: 200, sourceItemId: 'item-2' }] }
assert.equal((await service.create(secondItem)).kind, 'created')
assert.equal((await service.create({ ...request, invoiceNumber: 'INV260900000009' })).kind, 'validation_error')
legacyLine = true
assert.equal((await service.create(secondItem)).kind, 'created')
assert.equal((await service.create({ ...request, invoiceNumber: 'INV260900000009' })).kind, 'validation_error')
sourcedLine = false
assert.equal((await service.create(secondItem)).kind, 'validation_error')
legacyLine = false
sourcedLine = true
orderInvoiceId = null
for (const [field, sku] of [['packageFeeId', 'PKG-FEE:pkg'], ['packageOverageId', 'PKG-OVERAGE:pkg']] as const) {
  existingSku = sku
  const packageLine = { description: 'Package charge', quantity: 1, unit: 'package', unitPrice: 25, adjustments: [], [field]: 'pkg' }
  assert.equal((await service.create({ ...request, invoiceNumber: 'INV260900000007', items: [packageLine] })).kind, 'validation_error')
  existingStatus = 'VOID'
  assert.equal((await service.create({ ...request, invoiceNumber: 'INV260900000008', items: [packageLine] })).kind, 'created')
  existingStatus = 'ISSUED'
}
console.log('Invoice source ownership, active duplicate, and sheet keys dry test passed')
