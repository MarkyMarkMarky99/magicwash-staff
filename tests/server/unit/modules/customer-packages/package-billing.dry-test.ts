import assert from 'node:assert/strict'
import { PackageBillingService } from '../../../../../server/modules/customer-packages/package-billing.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

const transactions: Array<Record<string, unknown>> = [
  { id: 'purchase', customer_package_id: 'pkg', type: 'PURCHASE', credit_change: 1 },
  { id: 'usage', customer_package_id: 'pkg', type: 'USAGE', credit_change: -1.5 },
]
const invoiceLines: Array<Record<string, unknown>> = []
let legacyOrderInvoiceId: string | null = null
let includeLegacyManualOrder = false
const packageRow: Record<string, unknown> = { id: 'pkg', customer_id: 'customer', package_code: 'MONTH', start_date: '2026-09-01', expiry_date: '2026-09-30', invoice_id: null }
const invoiceRows: Array<Record<string, unknown>> = [
  { invoice_number: 'INV260900000003', customer_id: 'customer', billing_type: 'ORDER', status: 'ISSUED' },
  { invoice_number: 'INV260900000004', customer_id: 'customer', status: 'ISSUED' },
]
const orderItems = [
  { id: 'cash-item', order_id: 'order', item_id: 'item', description: 'Suit', quantity: 1 },
  { id: 'coat-item', order_id: 'order', item_id: 'coat', description: 'Coat', quantity: 1 },
  { id: 'credit-item', order_id: 'order', item_id: 'shirt', description: 'Shirt', quantity: 3 },
  { id: 'cancelled-item', order_id: 'cancelled', item_id: 'item', description: 'Suit', quantity: 1 },
  { id: 'tshirt-item', order_id: '33dd511b', item_id: 'tshirt', description: 'T-shirt', quantity: 4 },
]
const reads: Array<{ sheet: string; where: Record<string, unknown> | undefined }> = []
function readRows<T extends Record<string, unknown>>(sheet: string, source: T[], query?: { where?: Record<string, unknown> }): T[] {
  reads.push({ sheet, where: query?.where })
  return source.filter((row) => Object.entries(query?.where ?? {}).every(([key, value]) => row[key] === value))
}
const service = new PackageBillingService({
  packages: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('packages', [packageRow], query) }),
  plans: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('plans', [{ package_code: 'MONTH', name: 'Monthly', price: 1190, included_credit: 1 }], query) }),
  orders: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('orders', [
    { id: 'order', customer_id: 'customer', received_date: '2026-09-15', service_type: 'WASH', status: 'RECEIVED', invoice_id: legacyOrderInvoiceId },
    { id: 'cancelled', customer_id: 'customer', received_date: '2026-09-16', service_type: 'WASH', status: 'CANCELLED' },
    ...(includeLegacyManualOrder ? [{ id: '33dd511b', customer_id: 'customer', received_date: '2026-09-17', service_type: 'WASH', status: 'RECEIVED' }] : []),
  ], query) }),
  orderItems: () => ({ list: async ({ orderId }: { orderId: string }) => ({ items: readRows('orderItems', orderItems, { where: { order_id: orderId } })
    .map((row) => ({ orderItemId: row.id, orderId: row.order_id, itemId: row.item_id, description: row.description, quantity: row.quantity })) }) }),
  items: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('items', [
    { id: 'item', item_code: 'ITM-0001', display_name_th: 'Suit' },
    { id: 'coat', item_code: 'ITM-0003', display_name_th: 'Coat' },
    { id: 'shirt', item_code: 'ITM-0002', display_name_th: 'Shirt' },
    { id: 'tshirt', item_code: 'ITM-0004', display_name_th: 'T-shirt' },
  ], query) }),
  prices: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('prices', [
    { item_code: 'ITM-0001', service_type: 'WASH', price_group: 'DEFAULT', active: true, effective_from: '2020-01-01', effective_to: null, price: 180, unit: 'piece' },
    { item_code: 'ITM-0003', service_type: 'WASH', price_group: 'DEFAULT', active: true, effective_from: '2020-01-01', effective_to: null, price: 200, unit: 'piece' },
    { item_code: 'ITM-0002', service_type: 'WASH', price_group: 'CREDIT', active: true, effective_from: '2020-01-01', effective_to: null, price: 0.5, unit: 'piece' },
    { item_code: 'ITM-0004', service_type: 'WASH', price_group: 'DEFAULT', active: true, effective_from: '2020-01-01', effective_to: null, price: 25, unit: 'piece' },
  ], query) }),
  transactions: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('transactions', transactions, query), append: async (row: Record<string, unknown>) => { transactions.push(row); return row } }),
  invoiceItems: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('invoiceItems', invoiceLines, query) }),
  invoices: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('invoices', invoiceRows, query) }),
} as never)
const draft = await service.preview('pkg')
assert.equal(reads.filter((read) => read.sheet === 'items').length, 1)
assert.equal(reads.filter((read) => read.sheet === 'prices').length, 1)
assert.equal(reads.filter((read) => read.sheet === 'invoices').length, 1)
assert.equal(reads.filter((read) => read.sheet === 'invoiceItems').length, 3)
assert.equal(draft.overage, 0.5)
assert.equal(draft.overageLine?.unitPrice, 12.5)
assert.equal(draft.overageLine?.quantity, 1)
assert.equal(draft.usedCredit, 1.5)
assert.equal(draft.carriedIn, 0)
assert.equal(draft.carriedOut, 0)
assert.equal(draft.cashLines[0]?.unitPrice, 180)
assert.equal(draft.cashLines[0]?.sourceItemId, 'cash-item')
assert.equal(draft.cashLines.some((line) => line.sourceOrderId === 'cancelled'), false)
assert.deepEqual(draft.creditOrdersWithoutUsage, [{ orderId: 'order', totalCredits: 1.5 }])
assert.equal(draft.feeAlreadyInvoiced, false)
assert.equal(draft.feeLine?.unitPrice, 1190)
assert.equal(draft.feeLine?.packageFeeId, 'pkg')
includeLegacyManualOrder = true
assert.deepEqual((await service.preview('pkg')).cashLines.filter((line) => line.sourceOrderId === '33dd511b').map((line) => [line.quantity, line.unitPrice]), [[4, 25]])
transactions.push({ id: 'legacy-usage', customer_package_id: 'pkg', type: 'USAGE', credit_change: -8, reference_source: 'ORDER', reference_id: '33dd511b' })
const manualUsageDraft = await service.preview('pkg')
assert.equal(manualUsageDraft.cashLines.some((line) => line.sourceOrderId === '33dd511b'), false)
assert.equal(manualUsageDraft.creditOrdersWithoutUsage.some((order) => order.orderId === '33dd511b'), false)
assert.deepEqual(manualUsageDraft.coveredByManualUsage, [{ orderId: '33dd511b', credits: 8 }])
transactions.pop()
includeLegacyManualOrder = false
legacyOrderInvoiceId = 'INV260900000003'
invoiceLines.push({ invoice_number: 'INV260900000003', source_order_id: 'order', source_item_id: 'cash-item' })
const linkedSourced = await service.preview('pkg')
assert.deepEqual(linkedSourced.cashLines.map((line) => [line.sourceItemId, line.unitPrice]), [['coat-item', 200]])
assert.deepEqual(linkedSourced.alreadyInvoicedOrders, [])
invoiceLines.push({ invoice_number: 'INV260900000003', source_order_id: 'order', source_item_id: null, description: 'Delivery' })
const linkedSourcedWithDelivery = await service.preview('pkg')
assert.deepEqual(linkedSourcedWithDelivery.cashLines.map((line) => [line.sourceItemId, line.unitPrice]), [['coat-item', 200]])
assert.deepEqual(linkedSourcedWithDelivery.alreadyInvoicedOrders, [])
invoiceLines.pop()
invoiceLines.pop()
invoiceLines.push({ invoice_number: 'INV260900000003', source_order_id: 'order', source_item_id: null })
const linkedLegacy = await service.preview('pkg')
assert.equal(linkedLegacy.cashLines.length, 0)
assert.deepEqual(linkedLegacy.alreadyInvoicedOrders, [{ orderId: 'order', invoiceNumber: 'INV260900000003' }])
legacyOrderInvoiceId = null
invoiceLines.pop()
invoiceLines.push({ invoice_number: 'INV260900000003', sku: 'PKG-FEE:pkg' })
assert.equal((await service.preview('pkg')).feeLine, null)
invoiceLines.pop()
packageRow.invoice_id = 'INV260900999999'
const missingFeeInvoice = await service.preview('pkg')
assert.equal(missingFeeInvoice.feeAlreadyInvoiced, false)
assert.equal(missingFeeInvoice.feeLine?.unitPrice, 1190)
packageRow.invoice_id = 'INV260900000004'
const billedFee = await service.preview('pkg')
assert.equal(billedFee.feeAlreadyInvoiced, true)
assert.equal(billedFee.feeInvoiceNumber, 'INV260900000004')
assert.equal(billedFee.feeLine, null)
for (const status of ['VOID', 'CANCELLED']) {
  invoiceRows[1].status = status
  assert.equal((await service.preview('pkg')).feeLine?.unitPrice, 1190)
}
invoiceRows[1].status = 'ISSUED'
transactions[1].reference_source = 'Orders'
transactions[1].reference_id = 'order'
assert.deepEqual((await service.preview('pkg')).creditOrdersWithoutUsage, [])
invoiceLines.push({ invoice_number: 'INV260900000003', source_order_id: 'order', source_item_id: 'cash-item' })
assert.deepEqual((await service.preview('pkg')).cashLines.map((line) => line.sourceItemId), ['coat-item'])
invoiceLines.pop()
invoiceLines.push({ invoice_number: 'INV260900000003', sku: 'PKG-OVERAGE:pkg', unit_price: 12.5, quantity: 1 })
invoiceLines[0].unit_price = 10
await assert.rejects(() => service.settleOverage({ customerPackageId: 'pkg', invoiceNumber: 'INV260900000003', createdBy: 'staff' }), /negative balance/)
invoiceLines[0].unit_price = 12.5
const pendingOverage = await service.preview('pkg')
assert.equal(pendingOverage.overageLine, null)
assert.deepEqual(pendingOverage.pendingOverage, { invoiceNumber: 'INV260900000003', credits: 0.5 })
assert.equal((await service.settleOverage({ customerPackageId: 'pkg', invoiceNumber: 'INV260900000003', createdBy: 'staff' })).creditChange, 0.5)
await assert.rejects(() => service.settleOverage({ customerPackageId: 'pkg', invoiceNumber: 'INV260900000003', createdBy: 'staff' }), (error: unknown) => error instanceof ApiError && error.status === 409)
assert.ok(reads.some((read) => read.sheet === 'orderItems' && read.where?.order_id === 'order'))
assert.equal(reads.some((read) => read.sheet === 'orderItems' && read.where?.order_id === 'cancelled'), false)
assert.ok(reads.filter((read) => !['plans', 'items', 'prices', 'invoices'].includes(read.sheet))
  .every((read) => read.where && Object.keys(read.where).length > 0), 'large sheet reads must use equality keys')
assert.ok(reads.filter((read) => ['plans', 'items', 'prices', 'invoices'].includes(read.sheet)).every((read) => !read.where))
console.log('Package bill overage and duplicate adjustment dry test passed')
