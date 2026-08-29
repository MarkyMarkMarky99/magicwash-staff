import assert from 'node:assert/strict'

const environmentKeys = [
  'ORDERS_SPREADSHEET_ID',
  'PORTAL_SPREADSHEET_ID',
  'APPOINTMENTS_SPREADSHEET_ID',
  'CUSTOMERS_SPREADSHEET_ID',
  'INVOICES_SPREADSHEET_ID',
  'PRICE_LIST_SPREADSHEET_ID',
  'LAUNDRY_PACKAGES_SPREADSHEET_ID',
  'ISSUE_REPORTS_SPREADSHEET_ID',
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
  laundryPhotosModule,
  priceListModule,
  customerPackagesModule,
  packageTransactionsModule,
  packagesModule,
  issueReportsModule,
  orderItemFormsModule,
  orderImagesModule,
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
  import('../../../../server/sheets/LaundryPhotos/LaundryPhotos.repository.js'),
  import('../../../../server/sheets/PriceList/PriceList.repository.js'),
  import('../../../../server/sheets/CustomerPackages/CustomerPackages.repository.js'),
  import('../../../../server/sheets/PackageTransactions/PackageTransactions.repository.js'),
  import('../../../../server/sheets/Packages/Packages.repository.js'),
  import('../../../../server/sheets/IssueReports/IssueReports.repository.js'),
  import('../../../../server/sheets/OrderItemForms/OrderItemForms.repository.js'),
  import('../../../../server/sheets/OrderImages/OrderImages.repository.js'),
])

process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'
process.env.PORTAL_SPREADSHEET_ID = 'portal-spreadsheet-id'
process.env.APPOINTMENTS_SPREADSHEET_ID = 'appointments-spreadsheet-id'
process.env.CUSTOMERS_SPREADSHEET_ID = 'customers-spreadsheet-id'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-spreadsheet-id'
process.env.LAUNDRY_PACKAGES_SPREADSHEET_ID = 'laundry-packages-spreadsheet-id'
process.env.ISSUE_REPORTS_SPREADSHEET_ID = 'issue-reports-spreadsheet-id'

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
  ['LaundryPhotos', laundryPhotosModule.getLaundryPhotosRepository],
  ['PriceList', priceListModule.getPriceListRepository],
  ['CustomerPackages', customerPackagesModule.getCustomerPackagesRepository],
  ['PackageTransactions', packageTransactionsModule.getPackageTransactionsRepository],
  ['Packages', packagesModule.getPackagesRepository],
  ['IssueReports', issueReportsModule.getIssueReportsRepository],
  ['OrderItemForms', orderItemFormsModule.getOrderItemFormsRepository],
  ['OrderImages', orderImagesModule.getOrderImagesRepository],
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
