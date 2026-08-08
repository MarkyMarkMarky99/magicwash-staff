// MIGRATION SCAFFOLDING: this file imports the old ModuleContract contracts and
// must be deleted in §1.8 when ModuleContract goes away.

import assert from 'node:assert/strict'
import { appointmentsDbContract } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'
import { customerPackageViewDbContract } from '../../../../server/sheets/CustomerPackageView/CustomerPackageView.db-contract.js'
import { invoicesDbContract } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { invoiceItemsDbContract } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesViewDbContract } from '../../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { ordersViewDbContract } from '../../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'
import { appointmentContract } from '../../../../server/modules/appointments/appointment.contract.js'
import { customerContract } from '../../../../server/modules/customers/customer.contract.js'
import { customerPackageViewContract } from '../../../../server/modules/customer-packages/customer-package-view.contract.js'
import {
  invoiceContract,
  invoiceItemContract,
  invoiceViewContract,
  paymentContract,
} from '../../../../server/modules/invoices/invoice.contract.js'
import { orderContract, orderFormContract } from '../../../../server/modules/orders/order.contract.js'

type RowSchemaLike = { shape: Record<string, unknown> }
type RenamePair = readonly [oldName: string, newName: string]

interface ParityTest {
  name: string
  oldRow: RowSchemaLike
  newRow: RowSchemaLike
  pairs: readonly RenamePair[]
  oldTail?: readonly string[]
}

function rowKeys(row: RowSchemaLike): string[] {
  return Object.keys(row.shape)
}

function assertParity(test: ParityTest): void {
  const oldKeys = rowKeys(test.oldRow)
  const newKeys = rowKeys(test.newRow)
  const oldNames = test.pairs.map(([oldName]) => oldName)
  const newNames = test.pairs.map(([, newName]) => newName)

  assert.equal(test.pairs.length, newKeys.length, `${test.name} parity table length changed`)
  assert.deepEqual(newKeys, newNames, `${test.name} new schema changed outside the parity table`)
  assert.deepEqual(
    oldKeys.slice(0, newKeys.length),
    oldNames,
    `${test.name} old schema changed outside the parity table`,
  )

  for (const [oldName, newName] of test.pairs) {
    const oldIndex = oldKeys.indexOf(oldName)
    const newIndex = newKeys.indexOf(newName)

    assert.notEqual(oldIndex, -1, `${test.name} old field is missing: ${oldName}`)
    assert.notEqual(newIndex, -1, `${test.name} new field is missing: ${newName}`)
    assert.equal(newIndex, oldIndex, `${test.name} physical index changed: ${oldName} -> ${newName}`)
  }

  if (test.oldTail === undefined) {
    assert.equal(oldKeys.length, newKeys.length, `${test.name} has an unexpected old-schema tail`)
  } else {
    assert.deepEqual(
      oldKeys.slice(newKeys.length),
      test.oldTail,
      `${test.name} removed columns changed`,
    )
  }
}

const tests: ParityTest[] = [
  {
    name: 'OrdersView',
    oldRow: orderContract.db.row,
    newRow: ordersViewDbContract.row,
    pairs: [
      ['orderId', 'order_id'],
      ['customerId', 'customer_id'],
      ['orderNumber', 'order_number'],
      ['invoiceNumber', 'invoice_number'],
      ['receivedDate', 'received_date'],
      ['dueDate', 'due_date'],
      ['serviceType', 'service_type'],
      ['status', 'status'],
      ['quantity', 'quantity'],
      ['note', 'note'],
      ['itemsJson', 'items_json'],
      ['syncedAt', 'synced_at'],
      ['createdAt', 'created_at'],
    ],
  },
  {
    name: 'InvoicesView',
    oldRow: invoiceViewContract.db.row,
    newRow: invoicesViewDbContract.row,
    pairs: [
      ['invoiceNumber', 'invoiceNumber'],
      ['status', 'status'],
      ['billingType', 'billingType'],
      ['billingPeriodStart', 'billingPeriodStart'],
      ['billingPeriodEnd', 'billingPeriodEnd'],
      ['issuedDate', 'issuedDate'],
      ['dueDate', 'dueDate'],
      ['customerId', 'customerId'],
      ['customer', 'customerJson'],
      ['items', 'itemsJson'],
      ['adjustments', 'adjustmentsJson'],
      ['payments', 'paymentsJson'],
      ['subtotal', 'subtotal'],
      ['adjustmentTotal', 'adjustmentTotal'],
      ['grandTotal', 'grandTotal'],
      ['paidAmount', 'paidAmount'],
      ['balanceDue', 'balanceDue'],
    ],
  },
  {
    name: 'CustomerPackageView',
    oldRow: customerPackageViewContract.db.row,
    newRow: customerPackageViewDbContract.row,
    pairs: [
      ['customerPackageId', 'customerPackageId'],
      ['customerId', 'customerId'],
      ['customerName', 'customerName'],
      ['customerPhone', 'customerPhone'],
      ['customerAddress', 'customerAddress'],
      ['packageCode', 'packageCode'],
      ['packageName', 'packageName'],
      ['packageEligibleService', 'packageEligibleService'],
      ['startDate', 'startDate'],
      ['expiryDate', 'expiryDate'],
      ['status', 'status'],
      ['serviceDay', 'serviceDay'],
      ['timeSlot', 'timeSlot'],
      ['invoiceId', 'invoiceId'],
      ['notes', 'notes'],
      ['remainingCredit', 'remainingCredit'],
      ['usedCredit', 'usedCredit'],
      ['totalCredit', 'totalCredit'],
      ['transactions', 'transactionsJson'],
    ],
  },
  {
    name: 'Appointments',
    oldRow: appointmentContract.db.row,
    newRow: appointmentsDbContract.row,
    pairs: [
      ['AppointmentID', 'AppointmentID'],
      ['CustomerID', 'CustomerID'],
      ['AppointmentType', 'AppointmentType'],
      ['AppointmentDate', 'AppointmentDate'],
      ['TimeSlot', 'TimeSlot'],
      ['Status', 'Status'],
      ['Address', 'Address'],
      ['PickupOrderID', 'PickupOrderID'],
      ['DeliveryOrderID', 'DeliveryOrderID'],
      ['Notes', 'Notes'],
      ['CreatedAt', 'CreatedAt'],
      ['UpdatedAt', 'UpdatedAt'],
      ['CreatedBy', 'CreatedBy'],
      ['UpdatedBy', 'UpdatedBy'],
      ['ServiceTier', 'ServiceTier'],
    ],
    oldTail: ['DeletedAt', 'DeletedBy'],
  },
  {
    name: 'OrderForm',
    oldRow: orderFormContract.db.row,
    newRow: orderFormDbContract.row,
    pairs: [
      ['id', 'id'],
      ['order_number', 'order_number'],
      ['customer_id', 'customer_id'],
      ['received_date', 'received_date'],
      ['due_date', 'due_date'],
      ['service_type', 'service_type'],
      ['status', 'status'],
      ['quantity', 'quantity'],
      ['hangers', 'hangers'],
      ['bags', 'bags'],
      ['hangers_image', 'hangers_image'],
      ['bags_image', 'bags_image'],
      ['form_image', 'form_image'],
      ['note', 'note'],
      ['timestamp', 'timestamp'],
      ['created_by', 'created_by'],
      ['updated_at', 'updated_at'],
      ['updated_by', 'updated_by'],
      ['invoice_id', 'invoice_id'],
      ['order_name', 'order_name'],
      ['order_description', 'order_description'],
    ],
  },
  {
    name: 'Customers',
    oldRow: customerContract.db.row,
    newRow: customersDbContract.row,
    pairs: [
      ['Timestamp', 'Timestamp'],
      ['CustomerID', 'CustomerID'],
      ['CustomerIndex', 'CustomerIndex'],
      ['CustomerName', 'CustomerName'],
      ['Phone', 'Phone'],
      ['Address', 'Address'],
      ['Location', 'Location'],
      ['RegisteredDate', 'RegisteredDate'],
      ['Facebook', 'Facebook'],
      ['Line', 'Line'],
      ['Whatsapp', 'Whatsapp'],
      ['Email', 'Email'],
      ['CustomerType', 'CustomerType'],
      ['Source', 'Source'],
      ['ScheduledDays', 'ScheduledDays'],
      ['LastVisitDate', 'LastVisitDate'],
      ['PreferredContactMethod', 'PreferredContactMethod'],
      ['UpdatedAt', 'UpdatedAt'],
      ['UpdatedBy', 'UpdatedBy'],
      ['DeletedAt', 'DeletedAt'],
    ],
  },
  {
    name: 'Invoices',
    oldRow: invoiceContract.db.row,
    newRow: invoicesDbContract.row,
    pairs: [
      ['invoice_number', 'invoice_number'],
      ['status', 'status'],
      ['billing_type', 'billing_type'],
      ['billing_period_start', 'billing_period_start'],
      ['billing_period_end', 'billing_period_end'],
      ['issued_date', 'issued_date'],
      ['due_date', 'due_date'],
      ['customer_id', 'customer_id'],
      ['customer', 'customer'],
      ['adjustments', 'adjustments'],
      ['created_by', 'created_by'],
      ['created_at', 'created_at'],
      ['updated_at', 'updated_at'],
      ['updated_by', 'updated_by'],
      ['deleted_at', 'deleted_at'],
      ['deleted_by', 'deleted_by'],
    ],
  },
  {
    name: 'InvoiceItems',
    oldRow: invoiceItemContract.db.row,
    newRow: invoiceItemsDbContract.row,
    pairs: [
      ['invoice_number', 'invoice_number'],
      ['invoice_item_id', 'invoice_item_id'],
      ['item_no', 'item_no'],
      ['source_order_id', 'source_order_id'],
      ['source_item_id', 'source_item_id'],
      ['sku', 'sku'],
      ['service_type', 'service_type'],
      ['description', 'description'],
      ['quantity', 'quantity'],
      ['unit', 'unit'],
      ['unit_price', 'unit_price'],
      ['subtotal', 'subtotal'],
      ['adjustments', 'adjustments'],
      ['net_total', 'net_total'],
    ],
  },
  {
    name: 'Payments',
    oldRow: paymentContract.db.row,
    newRow: paymentsDbContract.row,
    pairs: [
      ['payment_id', 'payment_id'],
      ['invoice_number', 'invoice_number'],
      ['amount', 'amount'],
      ['method', 'method'],
      ['status', 'status'],
      ['paid_at', 'paid_at'],
      ['reference', 'reference'],
      ['proof_url', 'proof_url'],
      ['slip_data', 'slip_data'],
      ['notes', 'notes'],
      ['created_at', 'created_at'],
      ['created_by', 'created_by'],
      ['updated_at', 'updated_at'],
      ['updated_by', 'updated_by'],
      ['deleted_at', 'deleted_at'],
      ['deleted_by', 'deleted_by'],
    ],
  },
]

for (const test of tests) {
  assertParity(test)
}

console.log(`${tests.length} rename-parity dry tests passed`)
