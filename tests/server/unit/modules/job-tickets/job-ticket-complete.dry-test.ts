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
      async readRaw(): Promise<never> { throw new Error('not implemented') },
      queryBuilder(): never { throw new Error('not implemented') },
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
    row('progress', { department, status: 'In Progress', started_at: 'previous', started_by: 'starter-id' }),
    row('legacy-no-tag', { department, laundry_item_id: null, step_no: undefined }),
    row('weight', { department, scope: 'ORDER', task_code: 'PCK-WEIGHT-KG' }),
    row('done', { department, status: 'Completed' }), row('cancelled', { department, status: 'Cancelled' }),
    row('deleted', { department, deleted_at: 'yesterday' }), row('other-order', { department, order_id: '456' }),
    row('other-department', { department: 'Logistics' }),
    row('earlier', { department: 'Tagging', step_no: 0, laundry_item_id: 'pending' })]
  const context = setup(rows)
  const result = await context.service.completeOrder({ orderId: ' 123 ', department, scannedBy: 'forged' }, 'admin-id')
  assert.deepEqual(result, { kind: 'completed', scannedBy: 'admin-id', completed: [
    { ticketId: 'pending', status: 'Completed', startedAt: timestamp, startedBy: 'admin-id', completedAt: timestamp },
    { ticketId: 'progress', status: 'Completed', startedAt: 'previous', startedBy: 'starter-id', completedAt: timestamp },
    { ticketId: 'legacy-no-tag', status: 'Completed', startedAt: timestamp, startedBy: 'admin-id', completedAt: timestamp },
  ] })
  assert.deepEqual(context.reads, [{ where: { order_id: '123' } }])
  assert.equal(context.updates.length, 1)
  assert.equal(context.scores, 0)
  for (const update of context.updates[0]!) {
    assert.equal(update.patch.scanned_by, 'admin-id')
    assert.equal(update.patch.updated_by, 'admin-id')
  }
  const pendingPatch = context.updates[0]!.find(update => update.keyValue === 'pending')!.patch
  assert.equal(pendingPatch.started_at, timestamp)
  assert.equal(pendingPatch.started_by, 'admin-id')
  const progressPatch = context.updates[0]!.find(update => update.keyValue === 'progress')!.patch
  assert.equal('started_at' in progressPatch, false)
  assert.equal('started_by' in progressPatch, false)
  assert.equal(rows.find(ticket => ticket.id === 'progress')!.started_by, 'starter-id')
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
for (const department of ['Washing', 'DryCleaning', 'Ironing', 'Packaging', 'Logistics'] as const) {
  const ai = setup([row('ai', { department })])
  if (department === 'Washing' || department === 'Ironing') {
    const result = await ai.service.completeOrder({ orderId: '123', department }, 'AI')
    assert.equal(result.kind, 'completed')
    assert.equal(ai.updates[0]![0]!.patch.scanned_by, 'AI')
    assert.equal(ai.scores, 0)
  } else {
    await assert.rejects(ai.service.completeOrder({ orderId: '123', department }, 'AI'))
    assert.equal(ai.reads.length, 0)
  }
}

const secretaryClose = setup([row('secretary')])
const secretaryPayload = { orderId: '123', department: 'Packaging' }
await assert.rejects(secretaryClose.service.completeOrder(secretaryPayload, 'AI-owner',
  { staffId: 'owner', role: 'staff', departments: ['Washing'] }), { status: 403 })
assert.deepEqual(secretaryClose.reads, [])
const secretaryResult = await secretaryClose.service.completeOrder(secretaryPayload, 'AI-owner',
  { staffId: 'owner', role: 'staff', departments: ['Packaging'] })
assert.equal(secretaryResult.kind, 'completed')
assert.equal(secretaryClose.updates[0]![0]!.patch.scanned_by, 'AI-owner')
assert.equal(secretaryClose.updates[0]![0]!.patch.updated_by, 'AI-owner')
assert.equal(secretaryClose.scores, 0)

const moreOrderIds = Array.from({ length: 196 }, (_, index) => `order-${index}`)
const batchRows = [
  row('pending', { order_id: 123 as unknown as string }),
  row('progress', { order_id: '456', status: 'In Progress', started_at: 'previous', started_by: 'starter-id' }),
  row('legacy', { order_id: '456', laundry_item_id: null, step_no: undefined }),
  row('earlier', { department: 'Tagging', step_no: 0, laundry_item_id: 'pending' }),
  row('weight', { order_id: '456', scope: 'ORDER', task_code: 'PCK-WEIGHT-KG' }),
  row('done', { order_id: 'closed', status: 'Completed' }),
  row('cancelled', { order_id: 'closed', status: 'Cancelled' }),
  row('deleted', { order_id: 'closed', deleted_at: 'yesterday' }),
  row('unrequested', { order_id: 'other' }),
  ...moreOrderIds.map(orderId => row(`ticket-${orderId}`, { order_id: orderId })),
]
const batchPayload = { department: 'Packaging', orderIds: ['unknown', '456', 'closed', ' 123 ', ...moreOrderIds] }
const batch = setup(batchRows)
assert.deepEqual(await batch.service.completeOrders(batchPayload, 'admin-id'), {
  kind: 'completed', scannedBy: 'admin-id', results: [
    { orderId: 'unknown', completed: [] },
    { orderId: '456', completed: [
      { ticketId: 'progress', status: 'Completed', startedAt: 'previous', startedBy: 'starter-id', completedAt: timestamp },
      { ticketId: 'legacy', status: 'Completed', startedAt: timestamp, startedBy: 'admin-id', completedAt: timestamp },
    ] },
    { orderId: 'closed', completed: [] },
    { orderId: '123', completed: [
      { ticketId: 'pending', status: 'Completed', startedAt: timestamp, startedBy: 'admin-id', completedAt: timestamp },
    ] },
    ...moreOrderIds.map(orderId => ({ orderId, completed: [
      { ticketId: `ticket-${orderId}`, status: 'Completed', startedAt: timestamp, startedBy: 'admin-id', completedAt: timestamp },
    ] })),
  ],
})
assert.deepEqual(batch.reads, [undefined])
assert.equal(batch.updates.length, 1)
assert.equal(batch.updates[0]!.length, 199)
assert.deepEqual(new Set(batch.updates[0]!.map(update => update.keyValue)),
  new Set(['pending', 'progress', 'legacy', ...moreOrderIds.map(orderId => `ticket-${orderId}`)]))
assert.equal(batch.scores, 0)
assert.deepEqual(await batch.service.completeOrders({ department: 'Packaging', orderIds: ['456', '123', 'unknown'] }, 'admin-id'), {
  kind: 'completed', scannedBy: 'admin-id', results: ['456', '123', 'unknown'].map(orderId => ({ orderId, completed: [] })),
})
assert.equal(batch.reads.length, 2)
assert.equal(batch.updates.length, 1)

for (const payload of [
  { ...batchPayload, orderIds: [...batchPayload.orderIds, 'overflow'] },
  { ...batchPayload, orderIds: ['123', '123'] },
  { ...batchPayload, orderIds: ['123', ' 123 '] },
  { ...batchPayload, orderIds: [' '] },
  { ...batchPayload, orderIds: [123] },
  { ...batchPayload, orderIds: [] },
  { ...batchPayload, scannedBy: 'forged' },
]) await assert.rejects(invalid.service.completeOrders(payload, 'admin-id'), { status: 422 })
assert.equal(invalid.reads.length, 0)

for (const department of ['Washing', 'DryCleaning', 'Ironing', 'Packaging', 'Logistics'] as const) {
  const aiBatch = setup([row('ai-batch', { department })])
  const payload = { department, orderIds: ['123', '456'] }
  if (department === 'Washing' || department === 'Ironing') {
    assert.equal((await aiBatch.service.completeOrders(payload, 'AI')).kind, 'completed')
    assert.equal(aiBatch.updates[0]![0]!.patch.scanned_by, 'AI')
    assert.equal(aiBatch.scores, 0)
  } else {
    await assert.rejects(aiBatch.service.completeOrders(payload, 'AI'), { status: 403 })
    assert.equal(aiBatch.reads.length, 0)
  }
}

const secretaryBatch = setup([row('secretary-batch')])
const owner = { staffId: 'owner', role: 'staff' as const, departments: ['Washing' as const] }
await assert.rejects(secretaryBatch.service.completeOrders(batchPayload, 'AI-owner', owner), { status: 403 })
assert.equal(secretaryBatch.reads.length, 0)
assert.equal((await secretaryBatch.service.completeOrders(batchPayload, 'AI-owner', { ...owner, departments: ['Packaging'] })).kind, 'completed')
assert.equal(secretaryBatch.updates[0]![0]!.patch.scanned_by, 'AI-owner')
assert.equal(secretaryBatch.updates[0]![0]!.patch.updated_by, 'AI-owner')

for (const [failure, certainty] of [[new WriteRejectedError('updateMany', 'rejected'), 'rejected'], [new Error('transport'), 'unknown']] as const) {
  const rows = [row('pending'), row('other-pending', { order_id: '456' })]
  const failed = setup(rows, failure)
  assert.deepEqual(await failed.service.completeOrders(batchPayload, 'admin-id'), { kind: 'write_failed', certainty })
  assert.equal(failed.reads.length, 1)
  assert.equal(failed.updates.length, 1)
  assert.equal(failed.updates[0]!.length, 2)
  assert.equal(failed.scores, 0)
}

console.log('job-ticket-complete.dry-test: OK')
