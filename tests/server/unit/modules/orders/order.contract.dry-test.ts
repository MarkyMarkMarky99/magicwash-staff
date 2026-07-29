import assert from 'node:assert/strict'
import {
  orderFieldMap,
  orderRowSchema,
} from '../../../../../server/modules/orders/order.contract.js'
import { deriveGVizColumns } from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'

const expectedColumns = {
  orderId: 'A',
  customerId: 'B',
  orderNumber: 'C',
  invoiceNumber: 'D',
  receivedDate: 'E',
  dueDate: 'F',
  serviceType: 'G',
  status: 'H',
  quantity: 'I',
  note: 'J',
  itemsJson: 'K',
  syncedAt: 'L',
  createdAt: 'M',
}

assert.deepEqual(
  deriveGVizColumns(orderRowSchema),
  expectedColumns,
  'OrdersView fields must remain aligned with the physical A-M column order',
)

assert.deepEqual(
  orderFieldMap,
  Object.fromEntries(Object.keys(expectedColumns).map((field) => [field, field])),
  'Every OrdersView DB field must have an explicit identity mapping',
)

console.log('2 order contract dry tests passed')
