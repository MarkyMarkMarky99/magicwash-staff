import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { appointmentsDbContract } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customerPackageViewDbContract } from '../../../../server/sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import { customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'
import { invoiceItemsDbContract } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesDbContract } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { invoicesViewDbContract } from '../../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { ordersViewDbContract } from '../../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'

const expectedSheetCount = 9
const expectedSheetDirectories = [
  'Appointments',
  'CustomerPackageView',
  'Customers',
  'InvoiceItems',
  'Invoices',
  'InvoicesView',
  'OrderForm',
  'OrdersView',
  'Payments',
] as const

const bindings = [
  {
    name: 'Appointments',
    contract: appointmentsDbContract,
    expectedSpreadsheetId: 'APPOINTMENTS_SPREADSHEET_ID',
    expectedSheetName: 'Appointments',
  },
  {
    name: 'CustomerPackageView',
    contract: customerPackageViewDbContract,
    expectedSpreadsheetId: 'PORTAL_SPREADSHEET_ID',
    expectedSheetName: 'CustomerPackageView',
  },
  {
    name: 'Customers',
    contract: customersDbContract,
    expectedSpreadsheetId: 'CUSTOMERS_SPREADSHEET_ID',
    expectedSheetName: 'Customers',
  },
  {
    name: 'InvoiceItems',
    contract: invoiceItemsDbContract,
    expectedSpreadsheetId: undefined,
    expectedSheetName: 'InvoiceItems',
  },
  {
    name: 'Invoices',
    contract: invoicesDbContract,
    expectedSpreadsheetId: undefined,
    expectedSheetName: 'Invoices',
  },
  {
    name: 'InvoicesView',
    contract: invoicesViewDbContract,
    expectedSpreadsheetId: 'PORTAL_SPREADSHEET_ID',
    expectedSheetName: 'InvoicesView',
  },
  {
    name: 'OrderForm',
    contract: orderFormDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderForm',
  },
  {
    name: 'OrdersView',
    contract: ordersViewDbContract,
    expectedSpreadsheetId: 'PORTAL_SPREADSHEET_ID',
    expectedSheetName: 'OrdersView',
  },
  {
    name: 'Payments',
    contract: paymentsDbContract,
    expectedSpreadsheetId: undefined,
    expectedSheetName: 'Payments',
  },
] as const

const sheetRoot = fileURLToPath(new URL('../../../../server/sheets/', import.meta.url))
const filesystemSheetDirectories = readdirSync(sheetRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.equal(filesystemSheetDirectories.length, expectedSheetCount)
assert.deepEqual(filesystemSheetDirectories, [...expectedSheetDirectories].sort())
assert.equal(bindings.length, expectedSheetCount)
assert.deepEqual(
  bindings.map((binding) => binding.name).sort(),
  [...expectedSheetDirectories].sort(),
)

for (const binding of bindings) {
  const actualSpreadsheetId =
    'spreadsheetId' in binding.contract ? binding.contract.spreadsheetId : undefined

  assert.equal(
    actualSpreadsheetId,
    binding.expectedSpreadsheetId,
    `${binding.name} spreadsheetId env binding changed`,
  )
  assert.equal(
    binding.contract.sheetName,
    binding.expectedSheetName,
    `${binding.name} sheetName binding changed`,
  )
}

console.log(`sheet binding dry test passed (${expectedSheetCount} sheets)`)
