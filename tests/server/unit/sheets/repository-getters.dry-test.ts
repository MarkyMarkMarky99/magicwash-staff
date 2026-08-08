import assert from 'node:assert/strict'

const environmentKeys = [
  'APPSCRIPT_URL',
  'ORDERS_SPREADSHEET_ID',
  'PORTAL_SPREADSHEET_ID',
  'APPOINTMENTS_SPREADSHEET_ID',
  'CUSTOMERS_SPREADSHEET_ID',
  'INVOICES_SPREADSHEET_ID',
] as const

for (const key of environmentKeys) {
  delete process.env[key]
}

const [
  orderFormModule,
  ordersViewModule,
  appointmentsModule,
  customersModule,
  invoicesModule,
  invoiceItemsModule,
  paymentsModule,
  invoicesViewModule,
  customerPackageViewModule,
] = await Promise.all([
  import('../../../../server/sheets/OrderForm/OrderForm.repository.js'),
  import('../../../../server/sheets/OrdersView/OrdersView.repository.js'),
  import('../../../../server/sheets/Appointments/Appointments.repository.js'),
  import('../../../../server/sheets/Customers/Customers.repository.js'),
  import('../../../../server/sheets/Invoices/Invoices.repository.js'),
  import('../../../../server/sheets/InvoiceItems/InvoiceItems.repository.js'),
  import('../../../../server/sheets/Payments/Payments.repository.js'),
  import('../../../../server/sheets/InvoicesView/InvoicesView.repository.js'),
  import('../../../../server/sheets/CustomerPackageView/CustomerPackageView.repository.js'),
])

process.env.APPSCRIPT_URL = 'https://script.example/exec'
process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'
process.env.PORTAL_SPREADSHEET_ID = 'portal-spreadsheet-id'
process.env.APPOINTMENTS_SPREADSHEET_ID = 'appointments-spreadsheet-id'
process.env.CUSTOMERS_SPREADSHEET_ID = 'customers-spreadsheet-id'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'

const getters = [
  ['OrderForm', orderFormModule.getOrderFormRepository],
  ['OrdersView', ordersViewModule.getOrdersViewRepository],
  ['Appointments', appointmentsModule.getAppointmentsRepository],
  ['Customers', customersModule.getCustomersRepository],
  ['Invoices', invoicesModule.getInvoicesRepository],
  ['InvoiceItems', invoiceItemsModule.getInvoiceItemsRepository],
  ['Payments', paymentsModule.getPaymentsRepository],
  ['InvoicesView', invoicesViewModule.getInvoicesViewRepository],
  ['CustomerPackageView', customerPackageViewModule.getCustomerPackageViewRepository],
] as const

for (const [sheet, getRepository] of getters) {
  const first = getRepository()
  const second = getRepository()

  assert.strictEqual(second, first, `${sheet} getter must memoize its repository`)
  for (const method of ['read', 'append', 'batchAppend', 'update', 'delete'] as const) {
    assert.equal(typeof first[method], 'function', `${sheet} repository must expose ${method}`)
  }
}

console.log('sheet repository getter dry tests passed')
