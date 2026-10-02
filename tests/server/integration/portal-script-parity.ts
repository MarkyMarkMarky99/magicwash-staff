import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { getOrderFormRepository } from '../../../server/sheets/OrderForm/OrderForm.repository.js'
import { getOrderItemFormsRepository } from '../../../server/sheets/OrderItemForms/OrderItemForms.repository.js'
import { getInvoicesRepository } from '../../../server/sheets/Invoices/Invoices.repository.js'
import { getInvoiceItemsRepository } from '../../../server/sheets/InvoiceItems/InvoiceItems.repository.js'
import { getPaymentsRepository } from '../../../server/sheets/Payments/Payments.repository.js'
import { assemblePortalInvoices, assemblePortalOrders, type SourceRow } from '../../../server/modules/portal/portal.mapper.js'

const scriptDirectory = process.argv[2]
assert.ok(scriptDirectory, 'Pass the read-only MagicwashPortal Apps Script directory')
assert.equal(new Date('2026-10-03T00:00:00Z').getHours(), 7, 'Run the Apps Script oracle with TZ=Asia/Bangkok')
const sandbox = vm.createContext({ Date, Logger: { log() {} } })
vm.runInContext(readFileSync(join(scriptDirectory, 'Update.js'), 'utf8'), sandbox)
vm.runInContext(readFileSync(join(scriptDirectory, 'InvoiceViewSync.js'), 'utf8'), sandbox)
const [orders, orderItems, invoices, invoiceItems, payments] = await Promise.all([
  getOrderFormRepository().readSourceRows(), getOrderItemFormsRepository().readSourceRows(),
  getInvoicesRepository().readSourceRows(), getInvoiceItemsRepository().readSourceRows(), getPaymentsRepository().readSourceRows(),
])
const now = new Date()
const orderFields = Object.keys(orders[0]!)
const itemFields = Object.keys(orderItems[0]!)
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
  for (const field of ['customerJson', 'itemsJson', 'adjustmentsJson', 'paymentsJson', 'subtotal', 'adjustmentTotal', 'grandTotal', 'paidAmount', 'balanceDue', 'status'] as const) {
    assert.equal(actual[field], expected[field], field)
  }
}
console.log(`Original Apps Script against live sources: ${actualOrders.length} order JSON rows and ${actualInvoices.length} invoice JSON/status/totals rows match exactly`)
