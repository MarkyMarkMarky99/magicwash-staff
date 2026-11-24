import assert from 'node:assert/strict'
import type { z } from 'zod'
import { JobTicketReopenService } from '../../../../../server/modules/job-tickets/job-ticket-reopen.service.js'
import { jobTicketReopenResponseSchema } from '../../../../../contracts/job-tickets/job-ticket-api.schema.js'
import type { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import type { workTransactionsRowSchema } from '../../../../../server/sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { WriteRejectedError, WriteCommittedUnreadableError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { WorkTransactionService } from '../../../../../server/modules/work-transactions/work-transaction.service.js'

type Ticket = z.infer<typeof jobTicketsRowSchema>
type Transaction = z.infer<typeof workTransactionsRowSchema>
const ticket = (id: string, patch: Partial<Ticket> = {}): Partial<Ticket> => ({ id, order_id: 'o1',
  department: 'Washing', step_no: 1, laundry_item_id: 'tag1', scope: 'ITEM', status: 'Completed',
  started_at: 'start', started_by: 'A', completed_at: 'end', scanned_by: 'A', notes: 'original', ...patch })
const earn = (id: string, ticketId = 't1', actor = 'A'): Partial<Transaction> => ({ id,
  job_ticket_id: ticketId, type: 'EARN', minutes: 7, created_by: actor })
function setup(tickets = [ticket('t1')], transactions: Partial<Transaction>[] = []) {
  let ticketFailure: 'rejected' | 'committed' | undefined
  let voidFailure: 'rejected' | 'committed' | 'unreadable' | undefined
  let writes = 0
  let reads = 0
  const events: string[] = []
  const service = new JobTicketReopenService({
    repository: () => ({
      async read(query) { reads++; assert.deepEqual(query, { where: { order_id: 'o1' } }); return tickets },
      async updateMany(updates) {
        writes++; events.push('ticket')
        if (ticketFailure === 'rejected') throw new WriteRejectedError('updateMany', 'rejected')
        for (const update of updates) Object.assign(tickets.find(row => row.id === update.keyValue)!, update.patch)
        if (ticketFailure === 'committed') throw new Error('lost ticket response')
        return updates.map(update => tickets.find(row => row.id === update.keyValue)! as Ticket)
      },
    }),
    workTransactionRepository: () => ({
      async read() { return transactions },
      async batchAppend(rows) {
        events.push('void')
        if (voidFailure === 'rejected') throw new WriteRejectedError('batchAppend', 'rejected')
        transactions.push(...rows)
        if (voidFailure === 'unreadable') throw new WriteCommittedUnreadableError('batchAppend')
        if (voidFailure === 'committed') throw new Error('lost void response')
        return rows as Transaction[]
      },
    }),
    now: () => new Date('2026-11-17T03:04:05Z'),
  })
  return { service, tickets, transactions, events, get writes() { return writes }, get reads() { return reads },
    failTicket(value: typeof ticketFailure) { ticketFailure = value }, failVoid(value: typeof voidFailure) { voidFailure = value } }
}
const payload = { orderId: ' o1 ', department: 'Washing', ticketIds: [' t1 ', 't1'], reason: ' redo stain ' }
const run = async (context: ReturnType<typeof setup>, request: unknown = payload, actor = 'admin') => {
  const response = await context.service.reopen(request, actor)
  jobTicketReopenResponseSchema.parse(response)
  return response
}
const basic = setup([ticket('t1')], [earn('e1'), earn('e2'), { id: 'v0', job_ticket_id: 't1', type: 'VOID', notes: 'earn:e1 reopen: old', minutes: -7 }])
const first = await run(basic)
assert.deepEqual(first.results, [{ ticketId: 't1', outcome: 'reopened' }])
assert.equal(first.voidsWritten.length, 1)
assert.equal(first.voidsWritten[0]!.earnId, 'e2')
assert.deepEqual(basic.events, ['void', 'ticket'])
assert.deepEqual(basic.transactions.at(-1), { id: first.voidsWritten[0]!.id, job_ticket_id: 't1', type: 'VOID',
  minutes: -7, created_by: 'admin', notes: 'earn:e2 reopen: redo stain' })
for (const field of ['started_at', 'started_by', 'completed_at', 'scanned_by'] as const) assert.equal(basic.tickets[0]![field], null)
assert.equal(basic.tickets[0]!.status, 'Pending')
assert.equal(basic.tickets[0]!.updated_by, 'admin')
assert.equal(basic.tickets[0]!.notes, 'original\nreopen 2026-11-17 10:04:05 admin: redo stain')
assert.deepEqual((await run(basic)).results, [{ ticketId: 't1', outcome: 'already_reopened' }])
assert.equal(basic.writes, 1)
assert.equal(basic.transactions.length, 4)

for (const status of ['In Progress', 'Completed'] as const) {
  const gated = setup([ticket('t1'), ticket('later', { step_no: 2, department: 'Ironing', status })], [earn('e1')])
  assert.deepEqual((await run(gated)).results, [{ ticketId: 't1', outcome: 'blocked', reason: 'later_step', blockedByDepartment: 'Ironing' }])
  assert.deepEqual(gated.events, [])
}
for (const patch of [{ status: 'Pending' }, { status: 'Cancelled' }, { deleted_at: 'deleted' },
  { order_id: 'other' }, { laundry_item_id: 'other' }, { step_no: 1 }, { step_no: 0 }] as Partial<Ticket>[]) {
  const allowed = setup([ticket('t1'), ticket('later', { step_no: 2, department: 'Washing', ...patch })])
  assert.equal((await run(allowed)).results[0]!.outcome, 'reopened')
}
const skipped = setup([ticket('t1', { status: 'Pending', notes: 'no marker' }), ticket('wrong', { department: 'Ironing' }), ticket('deleted', { deleted_at: 'yesterday' })])
assert.deepEqual((await run(skipped, { ...payload, ticketIds: ['t1', 'wrong', 'deleted', 'missing'] })).results,
  [{ ticketId: 't1', outcome: 'skipped', reason: 'status_changed' }, ...['wrong', 'deleted', 'missing'].map(ticketId => ({ ticketId, outcome: 'skipped', reason: 'not_found' }))])
for (const notes of [null, 'legacy void', 'earn:unknown reopen: old']) {
  const legacy = setup([ticket('t1')], [earn('e1'), { id: 'old', job_ticket_id: 't1', type: 'VOID', minutes: -7, notes }])
  assert.deepEqual((await run(legacy)).results, [{ ticketId: 't1', outcome: 'blocked', reason: 'legacy_void' }])
  assert.deepEqual(legacy.events, [])
}
for (const failure of ['rejected', 'committed'] as const) {
  const retry = setup([ticket('t1')], [earn('e1')])
  retry.failTicket(failure)
  const failed = await run(retry)
  assert.equal(failed.kind, 'write_failed')
  if (failed.kind === 'write_failed') assert.equal(failed.certainty, failure === 'rejected' ? 'rejected' : 'unknown')
  assert.equal(failed.voidsWritten.length, 1)
  assert.deepEqual(failed.results, [])
  retry.failTicket(undefined)
  assert.equal((await run(retry)).results[0]!.outcome, failure === 'rejected' ? 'reopened' : 'already_reopened')
  assert.equal(retry.transactions.filter(row => row.type === 'VOID').length, 1)
  assert.equal(retry.writes, failure === 'rejected' ? 2 : 1)
}
for (const failure of ['rejected', 'committed'] as const) {
  const retry = setup([ticket('t1')], [earn('e1')])
  retry.failVoid(failure)
  assert.equal((await run(retry)).kind, 'write_failed')
  assert.equal(retry.writes, 0)
  retry.failVoid(undefined)
  assert.equal((await run(retry)).results[0]!.outcome, 'reopened')
  assert.equal(retry.transactions.filter(row => row.type === 'VOID').length, 1)
}
const unreadable = setup([ticket('t1')], [earn('e1')])
unreadable.failVoid('unreadable')
const unreadableResult = await run(unreadable)
assert.equal(unreadableResult.kind, 'write_failed')
assert.equal(unreadableResult.voidsWritten.length, 1, 'known committed VOID is retained despite unreadable response')
assert.equal(unreadable.writes, 0)
unreadable.failVoid(undefined)
assert.equal((await run(unreadable)).results[0]!.outcome, 'reopened')
assert.equal(unreadable.transactions.length, 2)

const reconcile = setup([ticket('t1', { status: 'Pending', notes: 'reopen 2026-11-17 10:04:05 admin: old' }),
  ticket('later', { department: 'Ironing', step_no: 2 })], [earn('e1')])
assert.equal((await run(reconcile)).results[0]!.outcome, 'already_reopened')
assert.equal(reconcile.writes, 0)
assert.equal(reconcile.transactions.filter(row => row.type === 'VOID').length, 1)

const partialBatch = setup([ticket('t1'), ticket('t2', { laundry_item_id: 'tag2' })], [earn('e1'), earn('e2', 't2')])
const partialResult = await run(partialBatch, { ...payload, ticketIds: ['t1', 'missing', 't2'] })
assert.deepEqual(partialResult.results.map(row => row.outcome), ['reopened', 'skipped', 'reopened'])
assert.equal(partialResult.voidsWritten.length, 2)
const noScore = setup([ticket('t1', { notes: null })])
assert.equal((await run(noScore)).voidsWritten.length, 0)
assert.equal(noScore.tickets[0]!.notes, 'reopen 2026-11-17 10:04:05 admin: redo stain')

const cycle = setup([ticket('t1')], [earn('A')])
await run(cycle)
Object.assign(cycle.tickets[0]!, { status: 'Completed', scanned_by: 'B' })
cycle.transactions.push(earn('B', 't1', 'B'))
const second = await run(cycle)
assert.deepEqual(second.voidsWritten.map(row => row.earnId), ['B'])
assert.deepEqual(cycle.transactions.filter(row => row.type === 'VOID').map(row => row.notes),
  ['earn:A reopen: redo stain', 'earn:B reopen: redo stain'])
assert.equal(cycle.tickets[0]!.notes!.split('\n').length, 3)

for (const department of ['Tagging', 'Washing', 'DryCleaning', 'Ironing', 'Packaging', 'Logistics'] as const) {
  const ai = setup([ticket('t1', { department })])
  if (department === 'Washing' || department === 'Ironing') assert.equal((await run(ai, { ...payload, department }, 'AI')).kind, 'completed')
  else {
    await assert.rejects(run(ai, { ...payload, department }, 'AI'), error => error instanceof ApiError && error.status === 403)
    assert.equal(ai.reads, 0)
  }
}
const invalid = setup()
for (const change of [{ reason: '' }, { reason: 'line\nbreak' }, { ticketIds: [] }, { orderId: '' }, { department: 'unknown' }, { unknown: true }]) {
  await assert.rejects(run(invalid, { ...payload, ...change }), error => error instanceof ApiError && error.status === 422)
}
assert.equal(invalid.reads, 0)

const secretaryReopen = setup([ticket('t1')], [{ ...earn('e1'), created_at: '2026-11-17 09:00:00' }])
await assert.rejects(secretaryReopen.service.reopen(payload, 'AI-owner',
  { staffId: 'owner', role: 'staff', departments: ['Ironing'] }), { status: 403 })
assert.equal(secretaryReopen.reads, 0)
assert.equal((await secretaryReopen.service.reopen(payload, 'AI-owner',
  { staffId: 'owner', role: 'staff', departments: ['Washing'] })).kind, 'completed')
assert.equal(secretaryReopen.tickets[0]?.updated_by, 'AI-owner')
assert.match(secretaryReopen.tickets[0]!.notes!, /AI-owner: redo stain$/)
secretaryReopen.transactions.at(-1)!.created_at = '2026-11-17 10:04:05'
const scores = await new WorkTransactionService(() => ({ read: async () => secretaryReopen.transactions }))
  .list({ from: '2026-11-17', to: '2026-11-17' })
assert.equal(scores.at(-1)?.type, 'VOID')
assert.equal(scores.at(-1)?.createdBy, 'AI-owner')
assert.equal(scores.at(-1)?.staffId, 'A')
console.log('job-ticket-reopen.dry-test: OK')
