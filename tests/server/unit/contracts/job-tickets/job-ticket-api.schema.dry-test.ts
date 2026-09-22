import assert from 'node:assert/strict'
import {
  jobTicketApiContract,
  jobTicketListQuerySchema,
  jobTicketResponseSchema,
  jobTicketScanRequestSchema,
  jobTicketScanResponseSchema,
  jobTicketUpdateSchema,
} from '../../../../../contracts/job-tickets/job-ticket-api.schema.js'

assert.deepEqual(jobTicketListQuerySchema.parse({}), {
  keyword: '', page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc',
})
assert.deepEqual(jobTicketListQuerySchema.parse({
  orderId: ' order-1 ', laundryItemId: ' tag-1 ', department: 'Washing', status: 'Pending',
}), {
  keyword: '', page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc',
  orderId: 'order-1', laundryItemId: 'tag-1', department: 'Washing', status: 'Pending',
})
assert.deepEqual(jobTicketUpdateSchema.parse({ status: 'Completed', updatedBy: ' staff-1 ', notes: 'ignored' }), {
  status: 'Completed', updatedBy: 'staff-1',
})
assert.throws(() => jobTicketUpdateSchema.parse({ updatedBy: 'staff-1' }))
assert.deepEqual(jobTicketScanRequestSchema.parse({
  laundryItemId: ' tag-1 ', department: 'Ironing', scannedBy: ' staff-2 ',
}), { laundryItemId: 'tag-1', department: 'Ironing', scannedBy: 'staff-2' })

const row = {
  id: 'ticket-1', orderId: 'order-1', laundryItemId: 'tag-1', scope: 'ITEM',
  serviceType: 'WSIR', department: 'Washing', stepNo: 1, customerId: 'customer-1',
  orderName: 'Order one', dueDate: '2026-09-30', specialInstructions: null, notes: null,
  status: 'Pending', startedAt: null, completedAt: null, scannedBy: null,
  photoEvidenceUrl: null, createdAt: '2026-09-23 10:00:00', createdBy: 'staff-1',
  updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null,
}
assert.deepEqual(jobTicketResponseSchema.parse(row), row)
assert.equal(jobTicketApiContract.response.detail, jobTicketResponseSchema)
assert.equal(jobTicketApiContract.response.update, jobTicketResponseSchema)
assert.equal(jobTicketScanResponseSchema.parse({
  kind: 'blocked', laundryItemId: 'tag-1', department: 'Ironing', blockedByDepartment: 'Washing',
}).kind, 'blocked')
assert.deepEqual(jobTicketScanResponseSchema.parse({
  kind: 'not_advanceable', ticketId: 'ticket-1', status: 'Cancelled',
}), { kind: 'not_advanceable', ticketId: 'ticket-1', status: 'Cancelled' })
assert.throws(() => jobTicketScanResponseSchema.parse({ kind: 'write_failed', ticketId: 'ticket-1', certainty: 'maybe' }))

console.log('job-ticket API contract dry test passed')
