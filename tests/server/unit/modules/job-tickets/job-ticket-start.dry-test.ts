import assert from 'node:assert/strict'
import type { z } from 'zod'
import { JobTicketStartService } from '../../../../../server/modules/job-tickets/job-ticket-start.service.js'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type JobTicketRow = z.infer<typeof jobTicketsRowSchema>

function ticket(overrides: Partial<JobTicketRow> = {}): Partial<JobTicketRow> {
  return {
    id: 'ticket-1', order_id: 'order-1', laundry_item_id: 'tag-1',
    department: 'Washing', step_no: 2, status: 'Pending', started_at: null,
    deleted_at: null, ...overrides,
  }
}

function serviceWith(rows: Array<Partial<JobTicketRow>>, updateError?: Error) {
  const reads: unknown[] = []
  const batches: unknown[] = []
  const service = new JobTicketStartService({
    repository: () => ({
      async read(query) { reads.push(query); return rows.filter(row => row.order_id === query?.where?.order_id) },
      async updateMany(updates) { batches.push(updates); if (updateError) throw updateError },
    }),
    now: () => new Date('2026-09-23T03:00:00.000Z'),
  })
  return { service, reads, batches }
}

const payload = { orderId: ' order-1 ', department: 'Washing', scannedBy: ' staff-1 ' }
const mixed = serviceWith([
  ticket({ id: 'earlier', department: 'Tagging', step_no: 1, status: 'Completed' }),
  ticket({ id: 'ticket-1' }),
  ticket({ id: 'ticket-2', laundry_item_id: 'tag-2', started_at: '2026-09-22 09:00:00' }),
  ticket({ id: 'missing', laundry_item_id: '' }),
  ticket({ id: 'other-department', department: 'Ironing' }),
  ticket({ id: 'not-pending', status: 'In Progress' }),
  ticket({ id: 'deleted', deleted_at: '2026-09-22 09:00:00' }),
  ticket({ id: 'different-order', order_id: 'order-2', department: 'Tagging', step_no: 1, status: 'Pending' }),
])
assert.deepEqual(await mixed.service.startOrder(payload), {
  kind: 'completed',
  advanced: [
    { ticketId: 'ticket-1', laundryItemId: 'tag-1', status: 'In Progress', startedAt: '2026-09-23 10:00:00' },
    { ticketId: 'ticket-2', laundryItemId: 'tag-2', status: 'In Progress', startedAt: '2026-09-22 09:00:00' },
  ],
  blocked: [], skippedWithoutTag: 1,
})
assert.deepEqual(mixed.reads, [{ where: { order_id: 'order-1' } }])
assert.deepEqual(mixed.batches, [[
  { keyValue: 'ticket-1', patch: { status: 'In Progress', started_at: '2026-09-23 10:00:00', scanned_by: 'staff-1', updated_by: 'staff-1' } },
  { keyValue: 'ticket-2', patch: { status: 'In Progress', scanned_by: 'staff-1', updated_by: 'staff-1' } },
]])

const blocked = serviceWith([
  ticket({ id: 'earlier', department: 'Tagging', step_no: 1, status: 'In Progress' }),
  ticket(),
  ticket({ id: 'missing', laundry_item_id: null as unknown as string }),
])
assert.deepEqual(await blocked.service.startOrder(payload), {
  kind: 'completed', advanced: [],
  blocked: [{ ticketId: 'ticket-1', laundryItemId: 'tag-1', blockedByDepartment: 'Tagging' }],
  skippedWithoutTag: 1,
})
assert.equal(blocked.batches.length, 0)

for (const [error, certainty] of [
  [new WriteRejectedError('UPDATE', 'rejected'), 'rejected'],
  [new WriteTransportError('UPDATE', 'network'), 'unknown'],
] as const) {
  const failing = serviceWith([ticket()], error)
  assert.deepEqual(await failing.service.startOrder(payload), {
    kind: 'write_failed', certainty, blocked: [], skippedWithoutTag: 0,
  })
  assert.equal(failing.batches.length, 1)
}

console.log('job-ticket start dry test passed')
