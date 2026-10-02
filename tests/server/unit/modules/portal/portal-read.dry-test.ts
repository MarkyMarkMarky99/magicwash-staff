import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { assemblePortalInvoices, assemblePortalOrders, type SourceRow } from '../../../../../server/modules/portal/portal.mapper.js'
import { PortalService } from '../../../../../server/modules/portal/portal.service.js'
import { createPortalRoutes } from '../../../../../server/modules/portal/portal.module.js'
import { portalInvoicesApi, portalOrdersApi } from '../../../../../contracts/portal/portal-api.schema.js'
import { ApiGateway } from '../../../../../server/shared/http/api-gateway.js'
import { routeRegistry } from '../../../../../server/api/route-registry.js'
import type { VercelRequest } from '@vercel/node'

const now = new Date('2026-10-03T18:30:00Z')
function nativeDates(rows: SourceRow[]): void {
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      const match = typeof value === 'string' ? /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/.exec(value) : null
      if (match) row[field] = new Date(Date.UTC(+match[1]!, +match[2]!, +match[3]!, +(match[4] ?? 0) - 7, +(match[5] ?? 0), +(match[6] ?? 0)))
    }
  }
}
const orders: SourceRow[] = [
  { id: 'second', customer_id: 'C', quantity: 2, invoice_id: 'INV', received_date: 'Date(2026,9,2)', due_date: null },
  { id: 'zero', customer_id: 'C', quantity: 0 },
  { id: 'first', customer_id: ' C ', quantity: 1, received_date: 'Date(2026,9,1)' },
  { id: 'nan', quantity: 'garbage' }, { id: 'infinity', quantity: Infinity },
  { id: 'negative', quantity: -1 }, { id: 'blank', quantity: null },
]
const orderItems: SourceRow[] = [
  { id: 'b', order_id: ' second ', quantity: 0, price: null },
  { id: 'a', order_id: 'second', quantity: 2, credits_used: 0 },
  { id: 'ignored', order_id: null },
]
nativeDates([...orders, ...orderItems])
const orderResult = assemblePortalOrders(orders, orderItems, now)
assert.deepEqual(orderResult.map((row) => row.orderId), ['second', 'first'])
assert.equal(orderResult[0]!.itemsJson, '[{"id":"b","item_id":"","description":"","quantity":0,"price":"","credits_used":"","category":"","service_type":"","special_instructions":""},{"id":"a","item_id":"","description":"","quantity":2,"price":"","credits_used":0,"category":"","service_type":"","special_instructions":""}]')
assert.equal(orderResult[0]!.invoiceNumber, 'INV')
assert.equal(orderResult[0]!.createdAt, '2026-10-02')
assert.equal(orderResult[0]!.dueDate, null)
assert.equal(orderResult[0]!.syncedAt, '2026-10-04')
assert.deepEqual(Object.keys(orderResult[0]!), Object.keys(portalOrdersApi.response.list.shape))
const numericIds = assemblePortalOrders([{ id: 123, customer_id: 456, quantity: 1 }], [{ id: 789, order_id: 123 }], now)[0]!
assert.equal(numericIds.orderId, '123', 'GViz exposes numeric identifiers in text columns as strings')
assert.equal(numericIds.customerId, '456')
assert.equal(JSON.parse(numericIds.itemsJson)[0].id, 789, 'JSON retains the original numeric cell type')
assert.equal(assemblePortalOrders([{ id: 'numeric', customer_id: 1.2345e24, quantity: 1 }], [], now)[0]!.customerId, '1.2345E+24')

const invoice: SourceRow = {
  invoice_number: 'INV', status: 'ISSUED', billing_type: 'CYCLE',
  billing_period_start: 'Date(2026,8,1)', billing_period_end: 'Date(2026,8,30)',
  issued_date: 'Date(2026,9,1)', due_date: 'Date(2026,9,3)', customer_id: 'C',
  customer: '{"customer_code":"C","customer_name":"Name","phone":null,"tax_id":""}',
  adjustments: JSON.stringify([
    { label: 'Fixed', calculation: 'FIXED', value: -0.005 },
    { label: 'Percent', calculation: 'PERCENT', value: -7.125 },
    { calculation: 'UNSUPPORTED', value: 123 },
  ]),
}
const items: SourceRow[] = [
  { invoice_number: 'INV', item_no: 2, description: 'Second', quantity: 3,
    unit_price: 12.345, subtotal: 37.035, net_total: 30.321, source_item_id: null,
    adjustments: '[{"label":"Fixed","calculation":"FIXED","value":-0.015},{"label":"Percent","calculation":"PERCENT","value":-5.123}]' },
  { invoice_number: 'INV', item_no: 1, description: 'First', quantity: 2, unit_price: 5, net_total: 10, adjustments: 'invalid' },
  { invoice_number: 'other', item_no: 0, net_total: 999 },
]
const payments: SourceRow[] = [
  { invoice_number: 'INV', amount: 5, method: 'CASH', status: 'VERIFIED', created_at: '2026-10-03T09:00:00+07:00', paid_at: 'Date(2026,9,3,9,0,0)' },
  { invoice_number: 'INV', amount: 9, method: 'OTHER', status: 'PENDING', created_at: null, proof_url: null },
  { invoice_number: 'INV', amount: -1, method: 'CASH', status: 'VERIFIED', created_at: 'Date(2026,9,3,8,0,0)', paid_at: '2026-10-03T08:00:00+07:00' },
  { invoice_number: 'INV', amount: 1000, status: 'VERIFIED', deleted_at: 'deleted' },
  { invoice_number: 'INV', amount: 20, status: 'FAILED', deleted_at: ' ', created_at: 'invalid' },
  { invoice_number: 'INV', amount: 20, status: 'CANCELLED', created_at: '2026-10-04T09:00:00+07:00' },
]
nativeDates([invoice, ...items, ...payments])
const invoiceResult = assemblePortalInvoices([invoice], items, payments, now)[0]!
assert.equal(invoiceResult.subtotal, 40.32)
assert.equal(invoiceResult.paidAmount, 4)
assert.equal(invoiceResult.status, 'PARTIALLY_PAID')
assert.equal(invoiceResult.billingPeriodStart, 'Date(2026,8,1)')
assert.equal(invoiceResult.customerJson, '{"customerCode":"C","customerName":"Name","taxId":"","phone":null}')
assert.deepEqual(JSON.parse(invoiceResult.itemsJson).map((item: SourceRow) => item.description), ['First', 'Second'])
assert.equal(JSON.parse(invoiceResult.itemsJson)[1].sourceItemId, '')
assert.deepEqual(JSON.parse(invoiceResult.paymentsJson).map((payment: SourceRow) => payment.status), ['PENDING', 'FAILED', 'VERIFIED', 'VERIFIED', 'CANCELLED'])
assert.equal(JSON.parse(invoiceResult.paymentsJson)[3].paidAt, '2026-10-03T02:00:00.000Z')
assert.deepEqual(Object.keys(invoiceResult), Object.keys(portalInvoicesApi.response.list.shape))
assert.equal(assemblePortalInvoices([{ ...invoice, deleted_at: 'x' }], items, payments, now).length, 0)
for (const status of ['DRAFT', 'CANCELLED', 'VOID', 'UNKNOWN']) {
  const row = assemblePortalInvoices([{ ...invoice, status }], items, payments, now)[0]!
  assert.equal(row.status, status)
  assert.equal(row.balanceDue, invoiceResult.balanceDue)
}
assert.equal(assemblePortalInvoices([invoice], items, [], now)[0]!.status, 'OVERDUE')
assert.equal(assemblePortalInvoices([invoice], items, [], new Date('2026-10-03T16:59:00Z'))[0]!.status, 'UNPAID')
assert.equal(assemblePortalInvoices([{ ...invoice, due_date: 'invalid' }], [], [], now)[0]!.status, 'UNPAID')
assert.equal(assemblePortalInvoices([invoice], items, [{ invoice_number: 'INV', status: 'VERIFIED', amount: 1000 }], now)[0]!.status, 'PAID')
assert.equal(assemblePortalInvoices([{ ...invoice, customer: '[]', adjustments: 'null' }], [], [], now)[0]!.customerJson, '{}')

let reads = 0
let liveOrders = orders
const reader = (rows: () => SourceRow[]) => () => ({ read: async () => { reads++; return rows() } })
const service = new PortalService({
  orders: reader(() => liveOrders), orderItems: reader(() => orderItems),
  invoices: reader(() => [invoice]), invoiceItems: reader(() => items), payments: reader(() => payments),
}, () => now)
assert.equal((await service.orders({ customerId: 'C', orderId: 'second' })).length, 1)
assert.equal((await service.orders({ customerId: ' C' })).length, 0)
assert.equal((await service.invoices({ invoiceNumber: ' INV' })).length, 0)
assert.equal((await service.invoices({ customerId: 'C', invoiceNumber: 'INV' })).length, 1)
const beforeInvalid = reads
await assert.rejects(service.orders({ customerId: ['C'] }))
await assert.rejects(service.invoices({ invoiceNumber: 123 }))
assert.equal(reads, beforeInvalid)
liveOrders = [{ id: 'new', quantity: 1 }]
assert.equal((await service.orders({}))[0]!.orderId, 'new')
const routes = createPortalRoutes(service)
const gateway = new ApiGateway({ portal: async () => routes }, async () => { throw new Error('unexpected authentication') })
const request = (url: string, method = 'GET', query = {}) => ({ url, method, query, headers: {} }) as VercelRequest
const response = await gateway.handleRequest(request('/api/portal/orders'))
assert.equal(response.status, 200)
assert.equal((response.body as { success: boolean }).success, true)
assert.equal((await gateway.handleRequest(request('/api/portal/invoices'))).status, 200)
assert.equal((await gateway.handleRequest(request('/api/portal/orders', 'POST'))).status, 405)
assert.equal((await gateway.handleRequest(request('/api/portal/nope'))).status, 404)
assert.equal((await gateway.handleRequest(request('/api/portal/invoices', 'GET', { customerId: ['C'] }))).status, 422)
assert.ok((await routeRegistry.portal()).item)

// Optional direct oracle against the read-only Apps Script checkout.
const scriptDirectory = process.argv[2]
if (scriptDirectory) {
  const sandbox = vm.createContext({ Date, Logger: { log() {} } })
  vm.runInContext(readFileSync(join(scriptDirectory, 'InvoiceViewSync.js'), 'utf8'), sandbox)
  vm.runInContext(readFileSync(join(scriptDirectory, 'Update.js'), 'utf8'), sandbox)
  const sourceValue = (value: unknown): unknown => {
    if (typeof value !== 'string' || !value.startsWith('Date(')) return value ?? ''
    const parts = value.slice(5, -1).split(',').map(Number)
    return new Date(parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 0, parts[4] ?? 0, parts[5] ?? 0)
  }
  const sourceRow = (row: SourceRow, fields: string[]) => Object.fromEntries(fields.map((field) => [field, sourceValue(row[field])]))
  const invoiceFields = ['invoice_number', 'status', 'billing_type', 'billing_period_start', 'billing_period_end', 'issued_date', 'due_date', 'customer_id', 'customer', 'adjustments']
  const itemFields = ['invoice_number', 'item_no', 'description', 'unit', 'quantity', 'unit_price', 'subtotal', 'net_total', 'source_order_id', 'source_item_id', 'service_type', 'adjustments']
  const paymentFields = ['invoice_number', 'deleted_at', 'amount', 'method', 'status', 'paid_at', 'proof_url', 'created_at']
  const scriptDateCell = (value: unknown) => value instanceof Date
    ? `Date(${value.getFullYear()},${value.getMonth()},${value.getDate()})` : value === '' ? null : value
  for (const status of ['ISSUED', 'DRAFT', 'CANCELLED', 'VOID', 'UNKNOWN']) {
    for (const adjustments of [invoice.adjustments, 'invalid', '[]', '[{"calculation":"FIXED","value":-50}]']) {
      const input = { ...invoice, status, adjustments }
      const parsed = sandbox.invoiceViewParseInvoice_(sourceRow(input, invoiceFields))
      const parsedItems = sandbox.invoiceViewParseItems_(items.filter((item) => item.invoice_number === 'INV').map((item) => sourceRow(item, itemFields)))
      parsedItems.sort((a: SourceRow, b: SourceRow) => sandbox.invoiceViewItemNumber_(a.item_no) - sandbox.invoiceViewItemNumber_(b.item_no))
      const parsedPayments = payments.map((row) => sourceRow(row, paymentFields)).filter((row) => !sandbox.invoiceViewHasValue_(row.deleted_at))
      parsedPayments.sort((a, b) => sandbox.invoiceViewTimestampMs_(a.created_at) - sandbox.invoiceViewTimestampMs_(b.created_at))
      const expected = sandbox.invoiceViewBuildRecord_(parsed, parsedItems, parsedPayments, now)
      for (const field of ['billingPeriodStart', 'billingPeriodEnd', 'issuedDate', 'dueDate']) expected[field] = scriptDateCell(expected[field])
      for (const field of ['issuedDate', 'dueDate']) expected[field] = field === 'issuedDate' ? '2026-10-01' : '2026-10-03'
      assert.deepEqual(assemblePortalInvoices([input], items, payments, now)[0], JSON.parse(JSON.stringify(expected)))
    }
  }
  const fields = ['id', 'order_id', 'item_id', 'description', 'quantity', 'price', 'credits_used', 'timestamp', 'category', 'service_type', 'special_instructions']
  const grouped = sandbox.positiveQuantityGroupItemsByOrderId_(orderItems.map((row) => fields.map((field) => sourceValue(row[field]))))
  assert.equal(orderResult[0]!.itemsJson, JSON.stringify(grouped.second))
  sandbox.runInvoiceViewSyncDryTests()
  console.log('Original Apps Script oracle: 20 invoice cases, order JSON parity, and 4 script dry tests passed')
}
console.log('Portal projection, live reads, exact filters, validation, routes, and envelope checks passed')
