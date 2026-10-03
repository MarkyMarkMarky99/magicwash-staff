import assert from 'node:assert/strict'
import type { z } from 'zod'
import { JobTicketAdvanceService, type WorkTransactionAppender } from '../../../../../server/modules/job-tickets/job-ticket-advance.service.js'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type Row = Partial<z.infer<typeof jobTicketsRowSchema>>
const row = (values: Row = {}): Row => ({
  id: 'one', order_id: '1', laundry_item_id: 'tag-1', department: 'Washing',
  step_no: 2, status: 'Pending', started_at: null, completed_at: null, deleted_at: null, work_minutes: 12, ...values,
})
function setup(rows: Row[], error?: Error, scoreError?: Error) {
  const reads: string[] = []
  const batches: unknown[] = []
  const earnBatches: Parameters<WorkTransactionAppender['batchAppend']>[0][] = []
  let workRepositoryCalls = 0
  let updateSucceeded = false
  const service = new JobTicketAdvanceService({
    repository: () => ({
      async read(query) {
        const orderId = String(query?.where?.order_id)
        reads.push(orderId)
        return rows.filter(item => String(item.order_id) === orderId)
      },
      async updateMany(updates) { batches.push(updates); if (error) throw error; updateSucceeded = true },
    }),
    workTransactionRepository: () => {
      workRepositoryCalls += 1
      assert.equal(updateSucceeded, true)
      return {
        async batchAppend(rows) { earnBatches.push(rows); if (scoreError) throw scoreError },
      }
    },
    now: () => new Date('2026-09-23T03:00:00Z'),
  })
  return { service, reads, batches, earnBatches, get workRepositoryCalls() { return workRepositoryCalls } }
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
  assert.equal(pendingResult.scoreFailed, 0)
  assert.deepEqual(pendingResult.advanced.map(item => item.ticketId), ['one', 'two'])
  assert.equal(pendingResult.advanced[0]?.startedAt, '2026-09-23 10:00:00')
  assert.equal(pendingResult.advanced[1]?.startedAt, 'previous')
  assert.equal(pendingResult.advanced[0]?.completedAt, null)
}
assert.deepEqual(pending.reads, ['1'])
assert.equal(pending.earnBatches.length, 0)
assert.equal(pending.workRepositoryCalls, 0)
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
  scoreFailed: 0,
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
assert.equal(mixed.earnBatches.length, 1)
const mixedEarn = mixed.earnBatches[0]![0]!
assert.match(mixedEarn.id!, /^[a-z0-9]{8}$/)
assert.deepEqual(mixed.earnBatches[0]!.map(({ id, ...row }) => row), [
  { job_ticket_id: 'done', type: 'EARN', minutes: 12, notes: null, created_by: 'staff' },
])
const empty = setup([row({ status: 'Completed' })])
assert.deepEqual(await empty.service.advance(request([{ ticketId: 'one', orderId: '1' }])), {
  kind: 'completed', advanced: [], blocked: [], skipped: [{ ticketId: 'one', reason: 'status_changed' }], scoreFailed: 0,
})
assert.equal(empty.batches.length, 0)
assert.equal(empty.earnBatches.length, 0)
assert.equal(empty.workRepositoryCalls, 0)
for (const [error, certainty] of [
  [new WriteRejectedError('UPDATE', 'rejected'), 'rejected'], [new WriteTransportError('UPDATE', 'transport'), 'unknown'],
] as const) {
  const failed = setup([row({ status: 'In Progress' })], error)
  assert.deepEqual(await failed.service.advance(request([{ ticketId: 'one', orderId: '1' }], 'In Progress')), {
    kind: 'write_failed', certainty, blocked: [], skipped: [],
  })
  assert.equal(failed.earnBatches.length, 0)
  assert.equal(failed.workRepositoryCalls, 0)
}
const complete = setup([
  row({ id: 'one', status: 'In Progress', work_minutes: 0 }),
  row({ id: 'two', laundry_item_id: 'tag-2', status: 'In Progress', work_minutes: 7.5 }),
])
const completion = await complete.service.advance(request([
  { ticketId: 'one', orderId: '1' }, { ticketId: 'two', orderId: '1' }, { ticketId: 'one', orderId: '1' },
], 'In Progress'))
assert.equal(completion.kind, 'completed')
if (completion.kind === 'completed') assert.equal(completion.scoreFailed, 0)
assert.deepEqual(complete.reads, ['1'])
assert.equal(complete.earnBatches.length, 1)
assert.equal(complete.workRepositoryCalls, 1)
assert.deepEqual(complete.earnBatches[0]!.map(({ id, ...row }) => row), [
  { job_ticket_id: 'one', type: 'EARN', minutes: 0, notes: null, created_by: 'staff' },
  { job_ticket_id: 'two', type: 'EARN', minutes: 7.5, notes: null, created_by: 'staff' },
])
for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
  const missing = setup([row({ status: 'In Progress', work_minutes: value })])
  const missingResult = await missing.service.advance(request([{ ticketId: 'one', orderId: '1' }], 'In Progress'))
  assert.equal(missingResult.kind, 'completed')
  if (missingResult.kind === 'completed') assert.equal(missingResult.scoreFailed, 0)
  assert.equal(missing.earnBatches.length, 0)
  assert.equal(missing.workRepositoryCalls, 0)
}
const scoreError = new Error('score write failed')
const originalConsoleError = console.error
const loggedErrors: unknown[][] = []
console.error = (...args) => { loggedErrors.push(args) }
try {
  const failedScore = setup([
    row({ id: 'one', status: 'In Progress', work_minutes: 5 }),
    row({ id: 'two', laundry_item_id: 'tag-2', status: 'In Progress', work_minutes: 9 }),
    row({ id: 'three', laundry_item_id: 'tag-3', status: 'In Progress', work_minutes: null }),
  ], undefined, scoreError)
  const scoreResult = await failedScore.service.advance(request(['one', 'two', 'three'].map(ticketId => ({ ticketId, orderId: '1' })), 'In Progress'))
  assert.equal(scoreResult.kind, 'completed')
  if (scoreResult.kind === 'completed') {
    assert.equal(scoreResult.scoreFailed, 2)
    assert.equal(scoreResult.advanced.length, 3)
  }
  assert.equal(failedScore.earnBatches.length, 1)
  assert.equal(failedScore.earnBatches[0]!.length, 2)
  assert.deepEqual(loggedErrors, [['Failed to append WorkTransactions', scoreError]])
} finally {
  console.error = originalConsoleError
}
console.log('job-ticket-advance.dry-test: OK')
