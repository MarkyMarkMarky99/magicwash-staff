import assert from 'node:assert/strict'
import { appointmentsDbContract } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'
import { customerPackageViewDbContract } from '../../../../server/sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import { invoicesDbContract } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { invoiceItemsDbContract } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesViewDbContract } from '../../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
import { laundryPhotosDbContract } from '../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { ordersViewDbContract } from '../../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'
import { priceListDbContract } from '../../../../server/sheets/PriceList/PriceList.db-contract.js'
import { customerPackagesDbContract } from '../../../../server/sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { packageTransactionsDbContract } from '../../../../server/sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { packagesDbContract } from '../../../../server/sheets/Packages/Packages.db-contract.js'
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { deriveGVizColumns } from '../../../../server/shared/repositories/utils/gviz-query.builder.js'

interface SheetContractLike {
  row: { shape: Record<string, unknown> }
  primaryKey: string
}

interface ColumnOrderTest {
  name: string
  contract: SheetContractLike
  expected: Record<string, string>
  primaryKeyColumn: string
}

const tests: ColumnOrderTest[] = [
  {
    name: 'IssueReports',
    contract: issueReportsDbContract,
    expected: { IssueReportID: 'A', Title: 'B', Description: 'C', Status: 'D', ScreenshotUrl: 'E', CreatedAt: 'F', CreatedBy: 'G', UpdatedAt: 'H', UpdatedBy: 'I' },
    primaryKeyColumn: 'A',
  },
  {
    name: 'CustomerPackages',
    contract: customerPackagesDbContract,
    expected: {
      id: 'A', customer_id: 'B', package_code: 'C', start_date: 'D', expiry_date: 'E',
      service_day: 'F', time_slot: 'G', invoice_id: 'H', notes: 'I', created_at: 'J',
      created_by: 'K', updated_at: 'L', updated_by: 'M', deleted_at: 'N', deleted_by: 'O',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'OrderForm',
    contract: orderFormDbContract,
    expected: {
      id: 'A',
      order_number: 'B',
      customer_id: 'C',
      received_date: 'D',
      due_date: 'E',
      service_type: 'F',
      status: 'G',
      quantity: 'H',
      hangers: 'I',
      bags: 'J',
      hangers_image: 'K',
      bags_image: 'L',
      form_image: 'M',
      note: 'N',
      timestamp: 'O',
      created_by: 'P',
      updated_at: 'Q',
      updated_by: 'R',
      invoice_id: 'S',
      order_name: 'T',
      order_description: 'U',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'Appointments',
    contract: appointmentsDbContract,
    expected: {
      AppointmentID: 'A',
      CustomerID: 'B',
      AppointmentType: 'C',
      AppointmentDate: 'D',
      TimeSlot: 'E',
      Status: 'F',
      Address: 'G',
      PickupOrderID: 'H',
      DeliveryOrderID: 'I',
      Notes: 'J',
      CreatedAt: 'K',
      UpdatedAt: 'L',
      CreatedBy: 'M',
      UpdatedBy: 'N',
      ServiceTier: 'O',
      DeletedAt: 'P',
      DeletedBy: 'Q',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'Customers',
    contract: customersDbContract,
    expected: {
      Timestamp: 'A',
      CustomerID: 'B',
      CustomerIndex: 'C',
      CustomerName: 'D',
      Phone: 'E',
      Address: 'F',
      Location: 'G',
      RegisteredDate: 'H',
      Facebook: 'I',
      Line: 'J',
      Whatsapp: 'K',
      Email: 'L',
      CustomerType: 'M',
      Source: 'N',
      ScheduledDays: 'O',
      LastVisitDate: 'P',
      PreferredContactMethod: 'Q',
      UpdatedAt: 'R',
      UpdatedBy: 'S',
      DeletedAt: 'T',
    },
    primaryKeyColumn: 'B',
  },
  {
    name: 'Invoices',
    contract: invoicesDbContract,
    expected: {
      invoice_number: 'A',
      status: 'B',
      billing_type: 'C',
      billing_period_start: 'D',
      billing_period_end: 'E',
      issued_date: 'F',
      due_date: 'G',
      customer_id: 'H',
      customer: 'I',
      adjustments: 'J',
      created_by: 'K',
      created_at: 'L',
      updated_at: 'M',
      updated_by: 'N',
      deleted_at: 'O',
      deleted_by: 'P',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'InvoiceItems',
    contract: invoiceItemsDbContract,
    expected: {
      invoice_number: 'A',
      invoice_item_id: 'B',
      item_no: 'C',
      source_order_id: 'D',
      source_item_id: 'E',
      sku: 'F',
      service_type: 'G',
      description: 'H',
      quantity: 'I',
      unit: 'J',
      unit_price: 'K',
      subtotal: 'L',
      adjustments: 'M',
      net_total: 'N',
    },
    primaryKeyColumn: 'B',
  },
  {
    name: 'LaundryPhotos',
    contract: laundryPhotosDbContract,
    expected: {
      id: 'A',
      order_id: 'B',
      orderitem_id: 'C',
      item_id: 'D',
      image_path: 'E',
      image_url: 'F',
      notes: 'G',
      timestamp: 'H',
      created_by: 'I',
      updated_by: 'J',
      updated_at: 'K',
      checked: 'L',
      is_active: 'M',
      file_id: 'N',
      deleted_at: 'O',
      deleted_by: 'P',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'Payments',
    contract: paymentsDbContract,
    expected: {
      payment_id: 'A',
      invoice_number: 'B',
      amount: 'C',
      method: 'D',
      status: 'E',
      paid_at: 'F',
      reference: 'G',
      proof_url: 'H',
      slip_data: 'I',
      notes: 'J',
      created_at: 'K',
      created_by: 'L',
      updated_at: 'M',
      updated_by: 'N',
      deleted_at: 'O',
      deleted_by: 'P',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'OrdersView',
    contract: ordersViewDbContract,
    expected: {
      order_id: 'A',
      customer_id: 'B',
      order_number: 'C',
      invoice_number: 'D',
      received_date: 'E',
      due_date: 'F',
      service_type: 'G',
      status: 'H',
      quantity: 'I',
      note: 'J',
      items_json: 'K',
      synced_at: 'L',
      created_at: 'M',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'InvoicesView',
    contract: invoicesViewDbContract,
    expected: {
      invoiceNumber: 'A',
      status: 'B',
      billingType: 'C',
      billingPeriodStart: 'D',
      billingPeriodEnd: 'E',
      issuedDate: 'F',
      dueDate: 'G',
      customerId: 'H',
      customerJson: 'I',
      itemsJson: 'J',
      adjustmentsJson: 'K',
      paymentsJson: 'L',
      subtotal: 'M',
      adjustmentTotal: 'N',
      grandTotal: 'O',
      paidAmount: 'P',
      balanceDue: 'Q',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'CustomerPackageView',
    contract: customerPackageViewDbContract,
    expected: {
      customerPackageId: 'A',
      customerId: 'B',
      customerName: 'C',
      customerPhone: 'D',
      customerAddress: 'E',
      packageCode: 'F',
      packageName: 'G',
      packageEligibleService: 'H',
      startDate: 'I',
      expiryDate: 'J',
      status: 'K',
      serviceDay: 'L',
      timeSlot: 'M',
      invoiceId: 'N',
      notes: 'O',
      remainingCredit: 'P',
      usedCredit: 'Q',
      totalCredit: 'R',
      transactionsJson: 'S',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'PackageTransactions',
    contract: packageTransactionsDbContract,
    expected: {
      id: 'A', customer_package_id: 'B', customer_id: 'C', type: 'D', reference_source: 'E',
      reference_id: 'F', credit_change: 'G', notes: 'H', created_at: 'I', created_by: 'J',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'Packages',
    contract: packagesDbContract,
    expected: {
      package_code: 'A', name: 'B', eligible_service: 'C', included_credit: 'D', price: 'E',
      notes: 'F', created_at: 'G', created_by: 'H', updated_at: 'I', updated_by: 'J',
      deleted_at: 'K', deleted_by: 'L',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'PriceList',
    contract: priceListDbContract,
    expected: {
      id: 'A',
      item_code: 'B',
      category: 'C',
      subcategory: 'D',
      itemtype: 'E',
      variant: 'F',
      display_name_th: 'G',
      wash_dry_iron_price: 'H',
      iron_only_price: 'I',
      dry_clean_price: 'J',
      credit_eligible: 'K',
      effective_from: 'L',
      effective_to: 'M',
      active: 'N',
    },
    primaryKeyColumn: 'A',
  },
]

for (const test of tests) {
  const columns = deriveGVizColumns(test.contract.row)

  assert.deepEqual(columns, test.expected, `${test.name} column order changed`)
  assert.ok(
    Object.prototype.hasOwnProperty.call(test.contract.row.shape, test.contract.primaryKey),
    `${test.name} primary key is not a row field`,
  )
  assert.equal(
    columns[test.contract.primaryKey],
    test.primaryKeyColumn,
    `${test.name} primary-key column changed`,
  )
}

console.log(`${tests.length} column-order dry tests passed`)
