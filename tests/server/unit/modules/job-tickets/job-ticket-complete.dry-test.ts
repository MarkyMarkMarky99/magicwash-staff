import assert from 'node:assert/strict'
import type { z } from 'zod'
import type { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { JobTicketCompleteService } from '../../../../../server/modules/job-tickets/job-ticket-complete.service.js'
import type { JobTicketTransitionServiceOptions } from '../../../../../server/modules/job-tickets/job-ticket-transition.service.js'
import type { SheetRowUpdate } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { WriteRejectedError } from '../../../../../server/shared/repositories/sheets-api.client.js'

type Row = Partial<z.infer<typeof jobTicketsRowSchema>>
const timestamp = '2026-10-09 12:34:56'
const row = (id: string, values: Row = {}): Row => ({ id, order_id: '123', scope: 'ITEM',
  department: 'Packaging', step_no: 3, status: 'Pending', laundry_item_id: id, work_minutes: 5, ...values })
function setup(rows: Row[], failure?: Error) {
  const reads: unknown[] = []
  const updates: ReadonlyArray<SheetRowUpdate<z.infer<typeof jobTicketsRowSchema>>>[] = []
  let scores = 0
  const options: JobTicketTransitionServiceOptions = {
    repository: () => ({
      async read(query) { reads.push(query); return rows },
      async updateMany(batch) {
        updates.push(batch)
        if (failure) throw failure
        for (const update of batch) Object.assign(rows.find(ticket => ticket.id === update.keyValue)!, update.patch)
      },
    }),
    workTransactionRepository: () => { scores += 1; throw new Error('Score repository must never be opened') },
    now: () => new Date('2026-10-09T05:34:56Z'),
  }
  return { service: new JobTicketCompleteService(options), reads, updates, get scores() { return scores } }
}
for (const department of ['Washing', 'DryCleaning', 'Ironing', 'Packaging'] as const) {
  const rows = [row('pending', { department, order_id: 123 as unknown as string, started_at: '' }),
    row('progress', { department, status: 'In Progress', started_at: 'previous' }),
    row('legacy-no-tag', { department, laundry_item_id: null, step_no: undefined }),
    row('weight', { department, scope: 'ORDER', task_code: 'PCK-WEIGHT-KG' }),
    row('done', { department, status: 'Completed' }), row('cancelled', { department, status: 'Cancelled' }),
    row('deleted', { department, deleted_at: 'yesterday' }), row('other-order', { department, order_id: '456' }),
    row('other-department', { department: 'Logistics' }),
    row('earlier', { department: 'Tagging', step_no: 0, laundry_item_id: 'pending' })]
  const context = setup(rows)
  const result = await context.service.completeOrder({ orderId: ' 123 ', department, scannedBy: 'forged' }, 'admin-id')
  assert.deepEqual(result, { kind: 'completed', scannedBy: 'admin-id', completed: [
    { ticketId: 'pending', status: 'Completed', startedAt: timestamp, completedAt: timestamp },
    { ticketId: 'progress', status: 'Completed', startedAt: 'previous', completedAt: timestamp },
    { ticketId: 'legacy-no-tag', status: 'Completed', startedAt: timestamp, completedAt: timestamp },
  ] })
  assert.deepEqual(context.reads, [{ where: { order_id: '123' } }])
  assert.equal(context.updates.length, 1)
  assert.equal(context.scores, 0)
  for (const update of context.updates[0]!) {
    assert.equal(update.patch.scanned_by, 'admin-id')
    assert.equal(update.patch.updated_by, 'admin-id')
  }
  assert.equal(rows.find(ticket => ticket.id === 'weight')!.status, 'Pending')
  await context.service.completeOrder({ orderId: '123', department }, 'admin-id')
  assert.equal(context.updates.length, 1, 'retry writes nothing')
}
const logistics = setup([
  row('bag-pending', { scope: 'ORDER', department: 'Logistics', task_code: 'LOG-BAG', laundry_item_id: null }),
  row('bag-progress', { scope: 'ORDER', department: 'Logistics', task_code: 'LOG-BAG', status: 'In Progress' }),
  row('wrong-task', { scope: 'ORDER', department: 'Logistics', task_code: 'LOG-STANDARD' }),
  row('item', { department: 'Logistics', task_code: 'LOG-BAG' }),
  row('deleted-bag', { scope: 'ORDER', department: 'Logistics', task_code: 'LOG-BAG', deleted_at: 'yesterday' }),
])
const bags = await logistics.service.completeOrder({ orderId: '123', department: 'Logistics' }, 'admin-id')
assert.equal(bags.kind, 'completed')
if (bags.kind === 'completed') assert.deepEqual(bags.completed.map(ticket => ticket.ticketId), ['bag-pending', 'bag-progress'])
assert.equal(logistics.updates.length, 1)
assert.equal(logistics.scores, 0)
for (const [failure, certainty] of [[new WriteRejectedError('updateMany', 'rejected'), 'rejected'], [new Error('transport'), 'unknown']] as const) {
  const failed = setup([row('pending')], failure)
  assert.deepEqual(await failed.service.completeOrder({ orderId: '123', department: 'Packaging' }, 'admin-id'),
    { kind: 'write_failed', certainty })
  assert.equal(failed.scores, 0)
}
const invalid = setup([])
for (const payload of [{ orderId: ' ', department: 'Packaging' }, { orderId: '123', department: 'unknown' }])
  await assert.rejects(invalid.service.completeOrder(payload, 'admin-id'))
assert.equal(invalid.reads.length, 0)
console.log('job-ticket-complete.dry-test: OK')
