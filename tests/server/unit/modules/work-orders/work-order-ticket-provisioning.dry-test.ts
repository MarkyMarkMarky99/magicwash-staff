import assert from 'node:assert/strict'
import type { z } from 'zod'
import { WorkOrderService } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type OrderFormRow = z.infer<typeof orderFormRowSchema>

function orderRow(overrides: Partial<OrderFormRow> = {}): OrderFormRow {
  return {
    id: 'order-1', order_number: '1001', customer_id: 'customer-1', received_date: '2026-09-23',
    due_date: '2026-09-30', service_type: 'WASH', status: 'PENDING', quantity: 2,
    hangers: null, bags: null, hangers_image: null, bags_image: null, form_image: null,
    note: 'Rush', timestamp: '2026-09-23 09:00:00', created_by: 'staff-1', updated_at: null,
    updated_by: null, invoice_id: null, order_name: 'Order one', order_description: null,
    ...overrides,
  }
}

function createService(appendError?: Error) {
  const orderRepository: SheetRepositoryContract<OrderFormRow> = {
    async read() { return [orderRow()] },
    async append(row) { return orderRow(row) },
    async batchAppend(rows) { return rows.map((row) => orderRow(row)) },
    async update(_id, patch) { return orderRow({ ...patch, status: 'APPROVED' }) },
    async delete() { return orderRow() },
  }
  const appendCalls: Array<Array<Record<string, unknown>>> = []
  const service = new WorkOrderService({
    orderFormRepository: () => orderRepository,
    laundryPhotoRepository: () => ({
      async read() {
        return [
          { order_id: 'order-1', orderitem_id: 'line-1', item_id: 'tag-1' },
          { order_id: 'order-1', orderitem_id: 'missing-line', item_id: 'tag-2' },
        ]
      },
    }),
    orderItemRepository: () => ({
      async read() {
        return [{ id: 'line-1', order_id: 'order-1', service_type: 'WSIR', special_instructions: 'Delicate' }]
      },
    }),
    jobTicketRepository: () => ({
      async read() { return [{ order_id: 'order-1', laundry_item_id: 'tag-1', department: 'Washing' }] },
      async batchAppend(rows) {
        appendCalls.push(rows as Array<Record<string, unknown>>)
        if (appendError) throw appendError
        return rows
      },
    }),
  })
  return { service, appendCalls }
}

const successful = createService()
const response = await successful.service.update('order-1', {
  status: 'APPROVED', updatedBy: 'staff-2',
})
assert.equal(response.status, 'APPROVED')
assert.deepEqual(response.ticketProvisioning, {
  ticketsCreated: 4, skippedGarments: [], failure: null,
})
assert.equal(successful.appendCalls.length, 1)
assert.deepEqual(successful.appendCalls[0]?.map((row) => [row.laundry_item_id, row.department]), [
  ['tag-1', 'Ironing'], ['tag-1', 'Packaging'], ['tag-2', 'Washing'], ['tag-2', 'Packaging'],
])

for (const [error, certainty] of [
  [new WriteRejectedError('APPEND', 'rejected'), 'rejected'],
  [new WriteTransportError('APPEND', 'network'), 'unknown'],
] as const) {
  const failed = createService(error)
  const result = await failed.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
  assert.deepEqual(result.ticketProvisioning, {
    ticketsCreated: 0, skippedGarments: [], failure: { certainty },
  })
  assert.equal(result.status, 'APPROVED')
}

console.log('work-order ticket provisioning dry test passed')
