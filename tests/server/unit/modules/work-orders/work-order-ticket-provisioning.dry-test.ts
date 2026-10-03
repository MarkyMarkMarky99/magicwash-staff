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

function createService(appendError?: Error, workRateError?: Error) {
  const orderRepository: SheetRepositoryContract<OrderFormRow> = {
    async read() { return [orderRow()] },
    async append(row) { return orderRow(row) },
    async batchAppend(rows) { return rows.map((row) => orderRow(row)) },
    async update(_id, patch) { return orderRow(patch) },
    async delete() { return orderRow() },
  }
  const appendCalls: Array<Array<Record<string, unknown>>> = []
  const workRateCalls = { getters: 0, reads: 0 }
  const service = new WorkOrderService({
    orderFormRepository: () => orderRepository,
    workRateRepository: () => {
      workRateCalls.getters += 1
      return {
        async read(...args) {
          workRateCalls.reads += 1
          assert.deepEqual(args, [])
          if (workRateError) throw workRateError
          return [
            { department: 'Washing', active: true, level: 'EASY', minutes: 12 },
            { department: 'Ironing', active: true, level: 'EASY', minutes: 5 },
          ]
        },
      }
    },
    laundryPhotoRepository: () => ({
      async read() {
        return [
          { order_id: 'order-1', orderitem_id: 'line-1', item_id: 'tag-1', image_url: 'https://example.test/tag-1.jpg' },
          { order_id: 'order-1', orderitem_id: 'missing-line', item_id: 'tag-2', image_url: '' },
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
  return { service, appendCalls, workRateCalls }
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
assert.deepEqual(successful.workRateCalls, { getters: 1, reads: 1 })
assert.deepEqual(successful.appendCalls[0]?.map((row) => row.work_minutes), [5, null, 12, null])
assert.deepEqual(successful.appendCalls[0]?.map((row) => [row.laundry_item_id, row.department]), [
  ['tag-1', 'Ironing'], ['tag-1', 'Packaging'], ['tag-2', 'Washing'], ['tag-2', 'Packaging'],
])
assert.deepEqual(successful.appendCalls[0]?.map((row) => row.photo_evidence_url), [
  'https://example.test/tag-1.jpg', 'https://example.test/tag-1.jpg', null, null,
])
assert.ok(successful.appendCalls[0]?.every((row) => row.department !== 'Washing' || row.laundry_item_id !== 'tag-1'))

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

const originalConsoleError = console.error
const loggedErrors: unknown[][] = []
console.error = (...args) => { loggedErrors.push(args) }
try {
  const readError = new Error('WorkRates unavailable')
  const failedRates = createService(undefined, readError)
  const result = await failedRates.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
  assert.deepEqual(result, response)
  assert.deepEqual(failedRates.workRateCalls, { getters: 1, reads: 1 })
  assert.equal(failedRates.appendCalls.length, 1)
  assert.deepEqual(failedRates.appendCalls[0], successful.appendCalls[0]?.map((row) => ({
    ...row, work_minutes: null,
  })))
  assert.deepEqual(loggedErrors, [['Failed to read WorkRates', readError]])
} finally {
  console.error = originalConsoleError
}

const nonApproved = createService()
const nonApprovedResponse = await nonApproved.service.update('order-1', { status: 'RECEIVED', updatedBy: 'staff-2' })
assert.equal(nonApprovedResponse.status, 'RECEIVED')
assert.deepEqual(nonApprovedResponse.ticketProvisioning, {
  ticketsCreated: 0, skippedGarments: [], failure: null,
})
assert.deepEqual(nonApproved.workRateCalls, { getters: 0, reads: 0 })
assert.equal(nonApproved.appendCalls.length, 0)

console.log('work-order ticket provisioning dry test passed')
