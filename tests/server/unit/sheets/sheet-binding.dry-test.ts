import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { appointmentsDbContract } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customerPackageViewDbContract } from '../../../../server/sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import { customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'
import { invoiceItemsDbContract } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesDbContract } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { invoicesViewDbContract } from '../../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
import { laundryPhotosDbContract } from '../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { orderItemFormsDbContract } from '../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { orderImagesDbContract } from '../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import { ordersViewDbContract } from '../../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'
import { priceListDbContract } from '../../../../server/sheets/PriceList/PriceList.db-contract.js'
import { customerPackagesDbContract } from '../../../../server/sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { packageTransactionsDbContract } from '../../../../server/sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { packagesDbContract } from '../../../../server/sheets/Packages/Packages.db-contract.js'
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'

const expectedSheetCount = 17
const expectedSheetDirectories = [
  'Appointments',
  'CustomerPackages',
  'CustomerPackageView',
  'Customers',
  'InvoiceItems',
  'Invoices',
  'InvoicesView',
  'IssueReports',
  'LaundryPhotos',
  'OrderForm',
  'OrderImages',
  'OrderItemForms',
  'OrdersView',
  'PackageTransactions',
  'Packages',
  'Payments',
  'PriceList',
] as const

const bindings = [
  {
    name: 'IssueReports',
    contract: issueReportsDbContract,
    expectedSpreadsheetId: 'ISSUE_REPORTS_SPREADSHEET_ID',
    expectedSheetName: 'IssueReports',
  },
  {
    name: 'Appointments',
    contract: appointmentsDbContract,
    expectedSpreadsheetId: 'APPOINTMENTS_SPREADSHEET_ID',
    expectedSheetName: 'Appointments',
  },
  {
    name: 'CustomerPackages',
    contract: customerPackagesDbContract,
    expectedSpreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
    expectedSheetName: 'CustomerPackages',
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
    expectedSpreadsheetId: 'INVOICES_SPREADSHEET_ID',
    expectedSheetName: 'InvoiceItems',
  },
  {
    name: 'Invoices',
    contract: invoicesDbContract,
    expectedSpreadsheetId: 'INVOICES_SPREADSHEET_ID',
    expectedSheetName: 'Invoices',
  },
  {
    name: 'InvoicesView',
    contract: invoicesViewDbContract,
    expectedSpreadsheetId: 'PORTAL_SPREADSHEET_ID',
    expectedSheetName: 'InvoicesView',
  },
  {
    name: 'LaundryPhotos',
    contract: laundryPhotosDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'LaundryPhotos',
  },
  {
    name: 'OrderForm',
    contract: orderFormDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderForm',
  },
  {
    name: 'OrderImages',
    contract: orderImagesDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderImages',
  },
  {
    name: 'OrderItemForms',
    contract: orderItemFormsDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderItemForms',
  },
  {
    name: 'OrdersView',
    contract: ordersViewDbContract,
    expectedSpreadsheetId: 'PORTAL_SPREADSHEET_ID',
    expectedSheetName: 'OrdersView',
  },
  {
    name: 'PackageTransactions',
    contract: packageTransactionsDbContract,
    expectedSpreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
    expectedSheetName: 'PackageTransactions',
  },
  {
    name: 'Packages',
    contract: packagesDbContract,
    expectedSpreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
    expectedSheetName: 'Packages',
  },
  {
    name: 'Payments',
    contract: paymentsDbContract,
    expectedSpreadsheetId: undefined,
    expectedSheetName: 'Payments',
  },
  {
    name: 'PriceList',
    contract: priceListDbContract,
    expectedSpreadsheetId: 'PRICE_LIST_SPREADSHEET_ID',
    expectedSheetName: 'PriceList',
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
