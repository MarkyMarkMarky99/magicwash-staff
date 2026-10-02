import { formatBangkokTimestamp } from '../../../server/shared/utils/bangkok-timestamp.js'
import { readPortalSource, portalSourceDefinitions } from '../../../server/modules/portal/portal-source-reader.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { assemblePortalInvoices, assemblePortalOrders, type SourceRow } from '../../../server/modules/portal/portal.mapper.js'

const scriptDirectory = process.argv[2]
assert.ok(scriptDirectory, 'Pass the read-only MagicwashPortal Apps Script directory')
assert.equal(new Date('2026-10-03T00:00:00Z').getHours(), 7, 'Run the Apps Script oracle with TZ=Asia/Bangkok')
const sandbox = vm.createContext({ Date, Logger: { log() {} } })
vm.runInContext(readFileSync(join(scriptDirectory, 'Update.js'), 'utf8'), sandbox)
vm.runInContext(readFileSync(join(scriptDirectory, 'InvoiceViewSync.js'), 'utf8'), sandbox)
const [orders, orderItems, invoices, invoiceItems, payments] = await Promise.all([
  readPortalSource('orders'), readPortalSource('orderItems'),
  readPortalSource('invoices'), readPortalSource('invoiceItems'), readPortalSource('payments'),
])
const now = new Date()
const orderFields = Object.keys(portalSourceDefinitions.orders.contract.row.shape)
const itemFields = Object.keys(portalSourceDefinitions.orderItems.contract.row.shape)
const orderArrays = orders.map((row) => orderFields.map((field) => row[field]))
const itemArrays = orderItems.map((row) => itemFields.map((field) => row[field]))
const grouped = sandbox.positiveQuantityGroupItemsByOrderId_(itemArrays)
const actualOrders = assemblePortalOrders(orders, orderItems, now)
const positiveOrders = orderArrays.filter((row) => sandbox.positiveQuantityIsPositive_(row[7]))
assert.equal(actualOrders.length, positiveOrders.length)
for (const [index, row] of positiveOrders.entries()) {
  const key = String(row[0] || '').trim()
  assert.equal(actualOrders[index]!.itemsJson, JSON.stringify(grouped[key] ?? []))
}

function viewValue(value: unknown, dateOnly = false, numeric = false): unknown {
  if (value instanceof Date) {
    const day = formatBangkokTimestamp(value).slice(0, 10)
    if (dateOnly) return day
    const [y, m, d] = day.split('-').map(Number)
    return `Date(${y},${m! - 1},${d})`
  }
  if (value === '' || value == null) return null
  return numeric ? value : typeof value === 'number' ? String(value).replace('e', 'E') : String(value)
}
let builtOrders: unknown[][] = []
sandbox.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'source' }) }
sandbox.SpreadsheetApp = {
  openById: () => ({ getSheetByName: (name: string) => ({ getDataRange: () => ({ getValues: () =>
    name === 'OrderForm' ? [orderFields, ...orderArrays] : [itemFields, ...itemArrays] }) }) }),
  getActiveSpreadsheet: () => ({ getSheetByName: () => ({
    getLastRow: () => 1, setFrozenRows() {},
    getRange: (row: number) => ({ setValues: (values: unknown[][]) => { if (row === 2) builtOrders = values } }),
  }) }),
}
sandbox.buildOrdersViewPositiveQuantity()
const orderDates = new Set(['receivedDate', 'dueDate', 'syncedAt', 'createdAt'])
for (const [index, expected] of builtOrders.entries()) {
  const fields = Object.keys(actualOrders[index]!)
  const mapped = Object.fromEntries(fields.map((field, column) => [field,
    viewValue(expected[column], orderDates.has(field), field === 'quantity')]))
  assert.deepEqual(actualOrders[index], mapped)
}

const sourceTables: Record<string, SourceRow[]> = { Invoices: invoices, InvoiceItems: invoiceItems, Payments: payments }
const spreadsheet = {
  getSheetByName(name: string) {
    const rows = sourceTables[name]!
    const headers = Object.keys(rows[0]!)
    return { getDataRange: () => ({ getValues: () => [headers, ...rows.map((row) => headers.map((field) => row[field]))] }) }
  },
}
const actualInvoices = assemblePortalInvoices(invoices, invoiceItems, payments, now)
for (const actual of actualInvoices) {
  const source = sandbox.invoiceViewReadSourceRows_(spreadsheet, actual.invoiceNumber)
  const expected = sandbox.invoiceViewBuildRecord_(
    sandbox.invoiceViewParseInvoice_(source.invoice), sandbox.invoiceViewParseItems_(source.items), source.payments, now,
  )
  const dateFields = new Set(['issuedDate', 'dueDate'])
  const numericFields = new Set(['subtotal', 'adjustmentTotal', 'grandTotal', 'paidAmount', 'balanceDue'])
  const mapped = Object.fromEntries(Object.keys(actual).map((field) => [field,
    viewValue(expected[field], dateFields.has(field), numericFields.has(field))]))
  assert.deepEqual(actual, mapped)

}
console.log(`Original Apps Script against live sources: ${actualOrders.length} complete order rows and ${actualInvoices.length} complete invoice rows match exactly`)
