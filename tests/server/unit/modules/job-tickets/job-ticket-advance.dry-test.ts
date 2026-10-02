import assert from 'node:assert/strict'
import type { z } from 'zod'
import { JobTicketAdvanceService } from '../../../../../server/modules/job-tickets/job-ticket-advance.service.js'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type Row = Partial<z.infer<typeof jobTicketsRowSchema>>
const row = (values: Row = {}): Row => ({
  id: 'one', order_id: '1', laundry_item_id: 'tag-1', department: 'Washing',
  step_no: 2, status: 'Pending', started_at: null, completed_at: null, deleted_at: null, ...values,
})
function setup(rows: Row[], error?: Error) {
  const reads: string[] = []
  const batches: unknown[] = []
  const service = new JobTicketAdvanceService({
    repository: () => ({
      async read(query) {
        const orderId = String(query?.where?.order_id)
        reads.push(orderId)
        return rows.filter(item => String(item.order_id) === orderId)
      },
      async updateMany(updates) { batches.push(updates); if (error) throw error },
    }),
    now: () => new Date('2026-09-23T03:00:00Z'),
  })
  return { service, reads, batches }
}
const request = (tickets: { ticketId: string; orderId: string }[], fromStatus: 'Pending' | 'In Progress' = 'Pending') =>
  ({ department: 'Washing', fromStatus, tickets, scannedBy: ' staff ' })

const pending = setup([
  row({ id: 'one', order_id: 1 as unknown as string }),
  row({ id: 'two', order_id: 1 as unknown as string, laundry_item_id: 'tag-2', started_at: 'previous' }),
  row({ id: 'earlier', order_id: 1 as unknown as string, laundry_item_id: 'tag-2', step_no: 1, department: 'Tagging', status: 'Completed' }),
  row({ id: 'other', order_id: '2', laundry_item_id: 'tag-1', step_no: 1, department: 'Tagging', status: 'Pending' }),
])
const pendingResult = await pending.service.advance(request([
  { ticketId: 'one', orderId: '1' }, { ticketId: 'one', orderId: '2' },
  { ticketId: 'two', orderId: '1' },
]))
assert.equal(pendingResult.kind, 'completed')
if (pendingResult.kind === 'completed') {
  assert.deepEqual(pendingResult.advanced.map(item => item.ticketId), ['one', 'two'])
  assert.equal(pendingResult.advanced[0]?.startedAt, '2026-09-23 10:00:00')
  assert.equal(pendingResult.advanced[1]?.startedAt, 'previous')
  assert.equal(pendingResult.advanced[0]?.completedAt, null)
}
assert.deepEqual(pending.reads, ['1'])
assert.deepEqual(pending.batches[0], [
  { keyValue: 'one', patch: { status: 'In Progress', started_at: '2026-09-23 10:00:00', scanned_by: 'staff', updated_by: 'staff' } },
  { keyValue: 'two', patch: { status: 'In Progress', started_at: 'previous', scanned_by: 'staff', updated_by: 'staff' } },
])

const mixed = setup([
  row({ id: 'done', order_id: '1', status: 'In Progress' }),
  row({ id: 'blocked', order_id: '1', laundry_item_id: 'tag-2', status: 'In Progress' }),
  row({ id: 'prior', order_id: '1', laundry_item_id: 'tag-2', step_no: 1, department: 'Tagging' }),
  row({ id: 'wrong', order_id: '2', department: 'Ironing', status: 'In Progress' }),
  row({ id: 'changed', order_id: '2', status: 'Completed' }),
  row({ id: 'deleted', order_id: '2', deleted_at: 'yesterday', status: 'In Progress' }),
])
const result = await mixed.service.advance(request(['done', 'blocked', 'missing'].map(ticketId => ({ ticketId, orderId: '1' }))
  .concat(['wrong', 'changed', 'deleted'].map(ticketId => ({ ticketId, orderId: '2' }))), 'In Progress'))
assert.deepEqual(mixed.reads.sort(), ['1', '2'])
assert.deepEqual(result, {
  kind: 'completed',
  advanced: [{ ticketId: 'done', laundryItemId: 'tag-1', status: 'Completed', startedAt: '2026-09-23 10:00:00', completedAt: '2026-09-23 10:00:00' }],
  blocked: [{ ticketId: 'blocked', laundryItemId: 'tag-2', blockedByDepartment: 'Tagging' }],
  skipped: [
    { ticketId: 'missing', reason: 'not_found' }, { ticketId: 'wrong', reason: 'not_found' },
    { ticketId: 'changed', reason: 'status_changed' }, { ticketId: 'deleted', reason: 'not_found' },
  ],
})
assert.deepEqual(mixed.batches[0], [{ keyValue: 'done', patch: {
  status: 'Completed', started_at: '2026-09-23 10:00:00', completed_at: '2026-09-23 10:00:00', scanned_by: 'staff', updated_by: 'staff',
} }])
const empty = setup([row({ status: 'Completed' })])
assert.equal((await empty.service.advance(request([{ ticketId: 'one', orderId: '1' }]))).kind, 'completed')
assert.equal(empty.batches.length, 0)
for (const [error, certainty] of [
  [new WriteRejectedError('UPDATE', 'rejected'), 'rejected'], [new WriteTransportError('UPDATE', 'transport'), 'unknown'],
] as const) {
  const failed = setup([row()], error)
  assert.deepEqual(await failed.service.advance(request([{ ticketId: 'one', orderId: '1' }])), {
    kind: 'write_failed', certainty, blocked: [], skipped: [],
  })
}
console.log('job-ticket-advance.dry-test: OK')
