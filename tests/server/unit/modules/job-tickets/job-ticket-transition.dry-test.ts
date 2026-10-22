import assert from 'node:assert/strict'
import { deriveGVizColumns, GVizQueryBuilder } from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'
import type { z } from 'zod'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { JobTicketTransitionService, type WorkTransactionAppender } from '../../../../../server/modules/job-tickets/job-ticket-transition.service.js'

type Row = Partial<z.infer<typeof jobTicketsRowSchema>>
const timestamp = '2026-10-09 12:34:56'
const row = (id: string, values: Row = {}): Row => ({ id, order_id: '123', laundry_item_id: id,
  department: 'Packaging', step_no: 3, status: 'Pending', work_minutes: 5, ...values })
function setup(rows: Row[]) {
  const rawReads: string[] = []
  const reads: unknown[] = []
  const updates: unknown[] = []
  const scores: Parameters<WorkTransactionAppender['batchAppend']>[0][] = []
  const service = new JobTicketTransitionService({
    repository: () => ({
      queryBuilder() { return GVizQueryBuilder.fromColumns(deriveGVizColumns(jobTicketsRowSchema)) },
      async readRaw(query: string) {
        rawReads.push(query)
        const orderIds = [...query.matchAll(/B = '([^']*)'/g)].map(match => match[1])
        return rows.filter(ticket => ['Pending', 'In Progress', 'Cancelled'].includes(ticket.status ?? '')
          && orderIds.includes(String(ticket.order_id ?? '')))
      },
      async read(query) {
        reads.push(query)
        return rows.filter(row => Object.entries(query?.where ?? {}).every(([key, value]) => String(row[key as keyof Row]) === String(value)))
      },
      async updateMany(batch) { updates.push(batch); for (const update of batch) Object.assign(rows.find(row => row.id === update.keyValue)!, update.patch) },
    }),
    workTransactionRepository: () => ({ async batchAppend(batch) { scores.push(batch) } }),
    now: () => new Date('2026-10-09T05:34:56Z'),
  })
  return { service, rawReads, reads, updates, scores }
}
const request = (ids: string[], sources: string[] = ['Pending', 'In Progress']) => ({ department: 'Packaging',
  targetStatus: 'Completed', allowedSourceStatuses: sources, scannedBy: ' staff-1 ',
  tickets: ids.map(ticketId => ({ ticketId, orderId: '123' })) })
const rows = [row('pending', { order_id: 123 as unknown as string, started_at: '' }),
  row('progress', { status: 'In Progress', started_at: 'previous', started_by: 'original-starter', work_minutes: 0 }),
  row('done', { status: 'Completed' }), row('legacy', { work_minutes: null }),
  row('deleted', { deleted_at: 'yesterday' }), row('wrong', { department: 'Ironing' }),
  row('blocked'), row('prior', { laundry_item_id: 'blocked', step_no: 2, department: 'Ironing', status: 'Pending' }),
  row('lowest', { laundry_item_id: 'blocked', step_no: 1, department: 'Washing', status: 'Cancelled' }),
  row('other-order', { order_id: '456', laundry_item_id: 'pending', step_no: 1 }),
  row('deleted-prior', { laundry_item_id: 'pending', step_no: 1, deleted_at: 'yesterday' })]
const context = setup(rows)
const result = await context.service.transition(request(['pending', 'progress', 'done', 'legacy', 'deleted', 'wrong', 'missing', 'blocked', 'pending']), rows)
assert.equal(result.kind, 'completed')
if (result.kind === 'completed') {
  assert.deepEqual(result.advanced.map(row => row.ticketId), ['pending', 'progress', 'legacy'])
  assert.deepEqual(result.advanced.map(row => [row.startedAt, row.completedAt]), [[timestamp, timestamp], ['previous', timestamp], [timestamp, timestamp]])
  assert.deepEqual(result.skipped, [{ ticketId: 'done', reason: 'status_changed' }, { ticketId: 'deleted', reason: 'not_found' },
    { ticketId: 'wrong', reason: 'not_found' }, { ticketId: 'missing', reason: 'not_found' }])
  assert.deepEqual(result.blocked, [{ ticketId: 'blocked', laundryItemId: 'blocked', blockedByDepartment: 'Washing' }])
  assert.equal(result.scoreFailed, 0)
}
assert.equal(context.reads.length, 0)
assert.equal(context.updates.length, 1)
assert.equal(context.scores.length, 1)
const patches = context.updates[0] as Array<{ keyValue: string; patch: Row }>
assert.deepEqual(patches[0]!.patch, { status: 'Completed', started_at: timestamp,
  started_by: 'staff-1', completed_at: timestamp, scanned_by: 'staff-1', updated_by: 'staff-1' })
assert.deepEqual(patches[1]!.patch, { status: 'Completed', completed_at: timestamp,
  scanned_by: 'staff-1', updated_by: 'staff-1' })
assert.equal(rows[1]!.started_by, 'original-starter')
assert.deepEqual(context.scores[0]!.map(({ id, ...row }) => row), [
  { job_ticket_id: 'pending', type: 'EARN', minutes: 5, notes: null, created_by: 'staff-1' },
  { job_ticket_id: 'progress', type: 'EARN', minutes: 0, notes: null, created_by: 'staff-1' }])
await context.service.transition(request(['pending', 'progress', 'done', 'legacy']), rows)
assert.equal(context.updates.length, 1, 'retry never updates Completed tickets')
assert.equal(context.scores.length, 1, 'retry never earns again')
const disallowed = setup([row('pending')])
const rejected = await disallowed.service.transition(request(['pending'], ['In Progress']))
assert.deepEqual(rejected, { kind: 'completed', advanced: [], blocked: [], skipped: [{ ticketId: 'pending', reason: 'status_changed' }], scoreFailed: 0 })
assert.equal(disallowed.updates.length, 0)
assert.equal(disallowed.scores.length, 0)
assert.deepEqual(disallowed.reads, [])
assert.deepEqual(disallowed.rawReads, ["select * where (M = 'Pending' or M = 'In Progress' or M = 'Cancelled') and (B = '123')"])
const fallback = setup([row('done', { status: 'Completed', order_id: 123 as unknown as string })])
await fallback.service.transition(request(['done', 'missing']))
assert.deepEqual(fallback.reads, [{ where: { order_id: '123' } }])
assert.equal(fallback.rawReads.length, 1)
for (const invalid of [{ ...request(['pending']), scannedBy: ' ' }, { ...request(['pending']), targetStatus: 'Cancelled' },
  { ...request(['pending']), allowedSourceStatuses: ['Completed'] }]) await assert.rejects(context.service.transition(invalid, rows))
for (const department of ['Tagging', 'Washing', 'DryCleaning', 'Ironing', 'Packaging', 'Logistics'] as const) {
  const tickets = [row('first', { department, step_no: 1 }), row('second', { department, step_no: 2, laundry_item_id: 'first' })]
  const context = setup(tickets)
  const result = await context.service.transition({ ...request(['first', 'second'], ['Pending']), department, targetStatus: 'In Progress' }, tickets)
  assert.equal(result.kind, 'completed')
  if (result.kind === 'completed') {
    assert.deepEqual(result.advanced.map(ticket => ticket.ticketId), ['first'])
    assert.deepEqual(result.blocked, [{ ticketId: 'second', laundryItemId: 'first', blockedByDepartment: department }])
  }
  assert.equal(context.updates.length, 1)
  assert.equal(context.scores.length, 0)
  const patch = (context.updates[0] as Array<{ patch: Row }>)[0]!.patch
  assert.equal(patch.started_at, timestamp)
  assert.equal(patch.started_by, 'staff-1')
  assert.equal('scanned_by' in patch, false)
}
const existingStarter = [row('existing-starter', { started_by: 'original-starter' })]
const preserved = setup(existingStarter)
await preserved.service.transition(request(['existing-starter']), existingStarter)
assert.equal(existingStarter[0]!.started_at, timestamp)
assert.equal(existingStarter[0]!.started_by, 'original-starter')
assert.equal('started_by' in (preserved.updates[0] as Array<{ patch: Row }>)[0]!.patch, false)
for (const count of [50, 51]) {
  const tickets = Array.from({ length: count }, (_, index) => row(`ticket-${index}`, { order_id: `order-${index}` }))
  tickets.push(row('same-order', { order_id: 'order-0' }))
  const context = setup(tickets)
  const result = await context.service.transition({ ...request([]),
    tickets: tickets.map(ticket => ({ ticketId: ticket.id, orderId: ticket.order_id })),
  })
  assert.equal(result.kind, 'completed')
  if (result.kind === 'completed') assert.equal(result.advanced.length, count + 1)
  assert.equal(context.rawReads.length, count === 50 ? 1 : 2)
  assert.deepEqual(context.reads, [])
  for (const [index, query] of context.rawReads.entries()) {
    const ids = Array.from({ length: Math.min(50, count - index * 50) }, (_, offset) => `B = 'order-${index * 50 + offset}'`)
    assert.equal(query, `select * where (M = 'Pending' or M = 'In Progress' or M = 'Cancelled') and (${ids.join(' or ')})`)
  }
  assert.equal(context.rawReads.join(' ').split("B = 'order-0'").length - 1, 1)
}
console.log('job-ticket-transition.dry-test: OK')
