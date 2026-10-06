import assert from 'node:assert/strict'
import type { z } from 'zod'
import { WorkOrderService } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

import { resetWorkRatesCache } from '../../../../../server/modules/work-orders/job-ticket-provisioning.js'

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

function createService(appendError?: Error, workRateError?: Error, scoreError?: Error, staffError?: Error) {
  resetWorkRatesCache()
  const orderRepository: SheetRepositoryContract<OrderFormRow> = {
    async read() { return [orderRow()] },
    async append(row) { return orderRow(row) },
    async batchAppend(rows) { return rows.map((row) => orderRow(row)) },
    async update(_id, patch) { return orderRow(patch) },
    async delete() { return orderRow() },
  }
  const appendCalls: Array<Array<Record<string, unknown>>> = []
  const scoreCalls: Array<Array<Record<string, unknown>>> = []
  const existingRows: Array<{ order_id: string; laundry_item_id: string; department: 'Washing' | 'Tagging' | 'Ironing' | 'Packaging' }> = [
    { order_id: 'order-1', laundry_item_id: 'tag-1', department: 'Washing' },
  ]
  const workRateCalls = { getters: 0, reads: 0 }
  const service = new WorkOrderService({
    now: () => new Date('2026-10-06T03:00:00Z'),
    staffReader: async () => {
      if (staffError) throw staffError
      return new Map([['tagger@example.test', { staffId: 'tagger-1', email: 'tagger@example.test', name: 'Tagger', role: 'staff' as const }]])
    },
    workTransactionRepository: () => ({ async batchAppend(rows) {
      assert.equal(appendCalls.length, 1)
      scoreCalls.push(rows as Array<Record<string, unknown>>)
      if (scoreError) throw scoreError
      return rows
    } }),
    orderFormRepository: () => orderRepository,
    workRateRepository: () => {
      workRateCalls.getters += 1
      return {
        async read(...args) {
          workRateCalls.reads += 1
          assert.deepEqual(args, [])
          if (workRateError) throw workRateError
          return [
            { department: 'Tagging', active: true, level: 'EASY', minutes: 3 },
            { department: 'Washing', active: true, level: 'EASY', minutes: 12 },
            { department: 'Ironing', active: true, level: 'EASY', minutes: 5 },
          ]
        },
      }
    },
    laundryPhotoRepository: () => ({
      async read() {
        return [
          { order_id: 'order-1', orderitem_id: 'line-1', item_id: 'tag-1', created_by: ' tagger-1 ', image_url: 'https://example.test/tag-1.jpg' },
          { order_id: 'order-1', orderitem_id: 'missing-line', item_id: 'tag-2', created_by: 'legacy@example.test', image_url: '' },
        ]
      },
    }),
    orderItemRepository: () => ({
      async read() {
        return [{ id: 'line-1', order_id: 'order-1', service_type: 'WSIR', special_instructions: 'Delicate' }]
      },
    }),
    jobTicketRepository: () => ({
      async read() { return existingRows },
      async batchAppend(rows) {
        appendCalls.push(rows as Array<Record<string, unknown>>)
        if (appendError) throw appendError
        return rows
      },
    }),
  })
  return { service, appendCalls, workRateCalls, scoreCalls, existingRows }
}

const successful = createService()
const response = await successful.service.update('order-1', {
  status: 'APPROVED', updatedBy: 'staff-2',
})
assert.equal(response.status, 'APPROVED')
assert.deepEqual(response.ticketProvisioning, {
  ticketsCreated: 5, scoreFailed: 0, skippedGarments: [], failure: null,
})
assert.equal(successful.appendCalls.length, 1)
assert.deepEqual(successful.workRateCalls, { getters: 1, reads: 1 })
assert.deepEqual(successful.appendCalls[0]?.map((row) => row.work_minutes), [3, 5, null, 12, null])
assert.deepEqual(successful.appendCalls[0]?.map((row) => [row.laundry_item_id, row.department]), [
  ['tag-1', 'Tagging'], ['tag-1', 'Ironing'], ['tag-1', 'Packaging'], ['tag-2', 'Washing'], ['tag-2', 'Packaging'],
])
assert.deepEqual(successful.appendCalls[0]?.map((row) => row.photo_evidence_url), [
  'https://example.test/tag-1.jpg', 'https://example.test/tag-1.jpg', 'https://example.test/tag-1.jpg', null, null,
])
assert.ok(successful.appendCalls[0]?.every((row) => row.department !== 'Washing' || row.laundry_item_id !== 'tag-1'))

for (const [error, certainty] of [
  [new WriteRejectedError('APPEND', 'rejected'), 'rejected'],
  [new WriteTransportError('APPEND', 'network'), 'unknown'],
] as const) {
  const failed = createService(error)
  const result = await failed.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
  assert.deepEqual(result.ticketProvisioning, {
    ticketsCreated: 0, scoreFailed: 0, skippedGarments: [], failure: { certainty },
  })
  assert.equal(result.status, 'APPROVED')
  assert.equal(failed.scoreCalls.length, 0)
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
  assert.equal(failedRates.scoreCalls.length, 0)
  assert.deepEqual(failedRates.appendCalls[0], successful.appendCalls[0]?.map((row) => ({
    ...row, work_minutes: null,
  })))
  assert.deepEqual(loggedErrors, [['Failed to read WorkRates', readError]])
} finally {
  console.error = originalConsoleError
}

assert.equal(successful.scoreCalls.length, 1)
const earn = successful.scoreCalls[0]?.[0]
assert.match(String(earn?.id), /^[a-z0-9]{8}$/)
assert.deepEqual(earn, { id: earn?.id, job_ticket_id: 'TAG-order-1-tag-1', type: 'EARN', minutes: 3, notes: null, created_by: 'tagger-1' })
assert.equal(successful.appendCalls[0]?.[0]?.completed_at, '2026-10-06 10:00:00')
successful.existingRows.push(...successful.appendCalls[0]!.map(row => ({
  order_id: String(row.order_id), laundry_item_id: String(row.laundry_item_id),
  department: row.department as typeof successful.existingRows[number]['department'],
})))
const reapproval = await successful.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
assert.equal(reapproval.ticketProvisioning.ticketsCreated, 0)
assert.equal(reapproval.ticketProvisioning.scoreFailed, 0)
assert.equal(successful.scoreCalls.length, 1)
assert.equal(successful.appendCalls.length, 1)

const nonApproved = createService()
const nonApprovedResponse = await nonApproved.service.update('order-1', { status: 'RECEIVED', updatedBy: 'staff-2' })
assert.equal(nonApprovedResponse.status, 'RECEIVED')
assert.deepEqual(nonApprovedResponse.ticketProvisioning, {
  ticketsCreated: 0, scoreFailed: 0, skippedGarments: [], failure: null,
})
assert.deepEqual(nonApproved.workRateCalls, { getters: 0, reads: 0 })
assert.equal(nonApproved.appendCalls.length, 0)

console.error = (...args) => { loggedErrors.push(args) }
try {
  loggedErrors.length = 0
  const staffError = new Error('Staff unavailable')
  const failedStaff = createService(undefined, undefined, undefined, staffError)
  const staffResult = await failedStaff.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
  assert.equal(staffResult.ticketProvisioning.ticketsCreated, 4)
  assert.equal(staffResult.ticketProvisioning.scoreFailed, 0)
  assert.ok(failedStaff.appendCalls[0]?.every(row => row.department !== 'Tagging'))
  assert.equal(failedStaff.scoreCalls.length, 0)
  const scoreError = new Error('Scores unavailable')
  const failedScore = createService(undefined, undefined, scoreError)
  const scoreResult = await failedScore.service.update('order-1', { status: 'APPROVED', updatedBy: 'staff-2' })
  assert.deepEqual(scoreResult.ticketProvisioning, { ticketsCreated: 5, scoreFailed: 1, skippedGarments: [], failure: null })
  assert.equal(failedScore.appendCalls.length, 1)
  assert.equal(failedScore.scoreCalls.length, 1)
  assert.deepEqual(loggedErrors, [
    ['Failed to read staff list for Tagging', staffError],
    ['Failed to save Tagging scores', scoreError],
  ])
} finally {
  console.error = originalConsoleError
}
console.log('work-order ticket provisioning dry test passed')
