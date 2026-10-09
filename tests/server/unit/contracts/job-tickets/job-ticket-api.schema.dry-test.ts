import assert from 'node:assert/strict'
import {
  jobTicketApiContract,
  jobTicketCompleteOrderRequestSchema,
  jobTicketCompleteOrderResponseSchema,
  jobTicketAdvanceRequestSchema,
  jobTicketAdvanceResponseSchema,
  jobTicketListQuerySchema,
  jobTicketResponseSchema,
  jobTicketStartOrderRequestSchema,
  jobTicketStartOrderResponseSchema,
  jobTicketUpdateSchema,
} from '../../../../../contracts/job-tickets/job-ticket-api.schema.js'

assert.deepEqual(jobTicketCompleteOrderRequestSchema.parse({ orderId: ' 123 ', department: 'Packaging', scannedBy: 'forged' }),
  { orderId: '123', department: 'Packaging' })
for (const department of ['Washing', 'DryCleaning', 'Ironing', 'Packaging', 'Logistics'])
  assert.equal(jobTicketCompleteOrderRequestSchema.parse({ orderId: '123', department }).department, department)
for (const payload of [{ orderId: ' ', department: 'Packaging' }, { orderId: '123', department: 'Tagging' }])
  assert.throws(() => jobTicketCompleteOrderRequestSchema.parse(payload))
assert.equal(jobTicketCompleteOrderResponseSchema.parse({ kind: 'completed', completed: [{
  ticketId: 'one', status: 'Completed', startedAt: '2026-10-09 12:00:00', completedAt: '2026-10-09 12:00:00',
}], scannedBy: 'admin-id' }).kind, 'completed')
for (const certainty of ['rejected', 'unknown'])
  assert.deepEqual(jobTicketCompleteOrderResponseSchema.parse({ kind: 'write_failed', certainty }), { kind: 'write_failed', certainty })

assert.deepEqual(jobTicketListQuerySchema.parse({}), {
  keyword: '', page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc',
})
assert.deepEqual(jobTicketListQuerySchema.parse({
  orderId: ' order-1 ', laundryItemId: ' tag-1 ', department: 'Washing', status: 'Pending',
}), {
  keyword: '', page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc',
  orderId: 'order-1', laundryItemId: 'tag-1', department: 'Washing', status: 'Pending',
})
assert.equal(jobTicketListQuerySchema.parse({ sortBy: 'completedAt', sortOrder: 'desc' }).sortBy, 'completedAt')
assert.deepEqual(jobTicketUpdateSchema.parse({ status: 'Completed', updatedBy: ' staff-1 ', notes: 'ignored' }), {
  status: 'Completed', updatedBy: 'staff-1',
})
assert.throws(() => jobTicketUpdateSchema.parse({ updatedBy: 'staff-1' }))

const row = {
  id: 'ticket-1', orderId: 'order-1', laundryItemId: 'tag-1', scope: 'ITEM',
  taskCode: 'WSH-STANDARD', department: 'Washing', stepNo: 1, customerId: 'customer-1',
  orderName: 'Order one', dueDate: '2026-09-30', specialInstructions: null, notes: null,
  status: 'Pending', startedAt: null, completedAt: null, scannedBy: null,
  photoEvidenceUrl: null, createdAt: '2026-09-23 10:00:00', createdBy: 'staff-1',
  updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null, workMinutes: null,
}
assert.deepEqual(jobTicketResponseSchema.parse(row), row)
assert.equal(jobTicketApiContract.response.detail, jobTicketResponseSchema)
assert.equal(jobTicketApiContract.response.update, jobTicketResponseSchema)
assert.deepEqual(jobTicketResponseSchema.parse({ ...row, taskCode: null }).taskCode, null)
assert.equal('serviceType' in jobTicketResponseSchema.parse(row), false)
assert.deepEqual(jobTicketStartOrderRequestSchema.parse({ orderId: ' order-1 ', department: 'Washing', scannedBy: ' staff-1 ' }), {
  orderId: 'order-1', department: 'Washing', scannedBy: 'staff-1',
})
assert.throws(() => jobTicketStartOrderRequestSchema.parse({ orderId: ' ', department: 'Washing', scannedBy: 'staff-1' }))
assert.deepEqual(jobTicketStartOrderResponseSchema.parse({
  kind: 'completed',
  advanced: [{ ticketId: 'ticket-1', laundryItemId: 'tag-1', status: 'In Progress', startedAt: null }],
  blocked: [{ ticketId: 'ticket-2', laundryItemId: 'tag-2', blockedByDepartment: 'DryCleaning' }],
  skippedWithoutTag: 1,
}).kind, 'completed')
assert.deepEqual(jobTicketStartOrderResponseSchema.parse({
  kind: 'write_failed', certainty: 'unknown', blocked: [], skippedWithoutTag: 0,
}).kind, 'write_failed')
assert.throws(() => jobTicketStartOrderResponseSchema.parse({ kind: 'completed', advanced: [], blocked: [], skippedWithoutTag: -1 }))
assert.throws(() => jobTicketStartOrderResponseSchema.parse({ kind: 'write_failed', certainty: 'maybe', blocked: [], skippedWithoutTag: 0 }))

const advanceRequest = { department: 'Washing', fromStatus: 'Pending', tickets: [{ ticketId: ' one ', orderId: ' order ' }], scannedBy: ' staff ' }
assert.deepEqual(jobTicketAdvanceRequestSchema.parse(advanceRequest).tickets, [{ ticketId: 'one', orderId: 'order' }])
assert.throws(() => jobTicketAdvanceRequestSchema.parse({ ...advanceRequest, tickets: [] }))
assert.equal(jobTicketAdvanceRequestSchema.parse({ ...advanceRequest, tickets: Array(200).fill(advanceRequest.tickets[0]) }).tickets.length, 200)
assert.throws(() => jobTicketAdvanceRequestSchema.parse({ ...advanceRequest, tickets: Array(201).fill(advanceRequest.tickets[0]) }))
assert.throws(() => jobTicketAdvanceRequestSchema.parse({ ...advanceRequest, fromStatus: 'Completed' }))
assert.throws(() => jobTicketAdvanceRequestSchema.parse({ ...advanceRequest, tickets: [{ ticketId: ' ', orderId: 'order' }] }))
assert.equal(jobTicketAdvanceResponseSchema.parse({ kind: 'completed', advanced: [{ ticketId: 'one', laundryItemId: null, status: 'Completed', startedAt: null, completedAt: null }], blocked: [], skipped: [], scoreFailed: 0 }).kind, 'completed')
assert.equal(jobTicketAdvanceResponseSchema.parse({ kind: 'write_failed', certainty: 'unknown', blocked: [], skipped: [{ ticketId: 'two', reason: 'status_changed' }] }).kind, 'write_failed')
assert.throws(() => jobTicketAdvanceResponseSchema.parse({ kind: 'write_failed', certainty: 'maybe', blocked: [], skipped: [] }))

assert.equal(jobTicketApiContract.response.list.shape.laundryItemId.safeParse(null).success, true)

console.log('job-ticket API contract dry test passed')
