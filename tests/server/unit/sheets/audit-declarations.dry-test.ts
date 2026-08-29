import assert from 'node:assert/strict'
import { appointmentsDbContract } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'
import { invoiceItemsDbContract } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesDbContract } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { customerPackagesDbContract } from '../../../../server/sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { packageTransactionsDbContract } from '../../../../server/sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { packagesDbContract } from '../../../../server/sheets/Packages/Packages.db-contract.js'
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { orderImagesDbContract } from '../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import { orderItemFormsDbContract } from '../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'

const declaredAudits = [
  { name: 'IssueReports', contract: issueReportsDbContract, expected: { onAppend: ['CreatedAt'], onUpdate: ['UpdatedAt'] } },
  {
    name: 'CustomerPackages',
    contract: customerPackagesDbContract,
    expected: { onAppend: ['created_at'] },
  },
  {
    name: 'PackageTransactions',
    contract: packageTransactionsDbContract,
    expected: { onAppend: ['created_at'] },
  },
  {
    name: 'Appointments',
    contract: appointmentsDbContract,
    expected: { onAppend: ['CreatedAt', 'UpdatedAt'], onUpdate: ['UpdatedAt'] },
  },
  {
    name: 'Invoices',
    contract: invoicesDbContract,
    expected: { onAppend: ['created_at'], onUpdate: [] },
  },
  {
    name: 'OrderForm',
    contract: orderFormDbContract,
    expected: { onAppend: [], onUpdate: ['updated_at'] },
  },
  {
    name: 'Customers',
    contract: customersDbContract,
    expected: { onAppend: [], onUpdate: ['UpdatedAt'] },
  },
  {
    name: 'Packages',
    contract: packagesDbContract,
    expected: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  },
  {
    name: 'OrderItemForms',
    contract: orderItemFormsDbContract,
    expected: { onAppend: ['timestamp'] },
  },
  {
    name: 'OrderImages',
    contract: orderImagesDbContract,
    expected: { onAppend: ['created_at'] },
  },
] as const

for (const { name, contract, expected } of declaredAudits) {
  assert.deepEqual(
    (contract as unknown as { audit?: unknown }).audit,
    expected,
    `${name} audit declaration changed`,
  )
}

assert.equal(
  'audit' in invoiceItemsDbContract,
  false,
  'InvoiceItems must omit the audit key entirely',
)

console.log('sheet audit declarations dry test passed')
