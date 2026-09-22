import assert from 'node:assert/strict'
import type { z } from 'zod'
import { JobTicketScanService } from '../../../../../server/modules/job-tickets/job-ticket-scan.service.js'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type JobTicketRow = z.infer<typeof jobTicketsRowSchema>

function ticket(overrides: Partial<JobTicketRow>): Partial<JobTicketRow> {
  return {
    id: 'ticket-1', order_id: 'order-1', laundry_item_id: 'tag-1', scope: 'ITEM',
    service_type: 'WSIR', department: 'Washing', step_no: 1, status: 'Pending',
    started_at: null, completed_at: null, deleted_at: null, ...overrides,
  }
}

function serviceWith(rows: Array<Partial<JobTicketRow>>, updateError?: Error) {
  const updates: Array<{ id: string; patch: Partial<JobTicketRow> }> = []
  const service = new JobTicketScanService({
    repository: () => ({
      async read() { return rows },
      async update(id, patch) {
        updates.push({ id, patch })
        if (updateError) throw updateError
      },
    }),
    now: () => new Date('2026-09-23T03:00:00.000Z'),
  })
  return { service, updates }
}

const blocked = serviceWith([
  ticket({ status: 'In Progress' }),
  ticket({ id: 'ticket-2', department: 'Ironing', step_no: 2 }),
])
assert.deepEqual(await blocked.service.scan({
  laundryItemId: 'tag-1', department: 'Ironing', scannedBy: 'staff-1',
}), {
  kind: 'blocked', laundryItemId: 'tag-1', department: 'Ironing', blockedByDepartment: 'Washing',
})
assert.deepEqual(blocked.updates, [])

const firstScan = serviceWith([ticket({})])
assert.deepEqual(await firstScan.service.scan({
  laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1',
}), {
  kind: 'advanced', ticketId: 'ticket-1', status: 'In Progress',
  startedAt: '2026-09-23 10:00:00', completedAt: null,
})
assert.deepEqual(firstScan.updates[0]?.patch, {
  status: 'In Progress', started_at: '2026-09-23 10:00:00', scanned_by: 'staff-1', updated_by: 'staff-1',
})

const completion = serviceWith([ticket({ status: 'In Progress', started_at: '2026-09-23 09:00:00' })])
const completionResult = await completion.service.scan({
  laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-2',
})
assert.equal(completionResult.kind, 'advanced')
assert.equal(completionResult.kind === 'advanced' ? completionResult.status : null, 'Completed')
assert.equal(completion.updates[0]?.patch.completed_at, '2026-09-23 10:00:00')

const completed = serviceWith([ticket({ status: 'Completed' })])
assert.deepEqual(await completed.service.scan({
  laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1',
}), { kind: 'already_completed', ticketId: 'ticket-1' })

for (const [error, certainty] of [
  [new WriteRejectedError('UPDATE', 'rejected'), 'rejected'],
  [new WriteTransportError('UPDATE', 'network'), 'unknown'],
] as const) {
  const failing = serviceWith([ticket({})], error)
  assert.deepEqual(await failing.service.scan({
    laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1',
  }), { kind: 'write_failed', ticketId: 'ticket-1', certainty })
}

console.log('job-ticket scan dry test passed')
