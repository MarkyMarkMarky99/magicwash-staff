import assert from 'node:assert/strict'
import type { z } from 'zod'

import { WorkOrderService } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

class RecordingRepository implements SheetRepositoryContract<OrderFormDbRow> {
  readonly updateCalls: Array<{ id: string; data: Partial<OrderFormDbRow> }> = []
  readRows: Array<Partial<OrderFormDbRow>> = []

  async read(): Promise<Array<Partial<OrderFormDbRow>>> {
    return this.readRows
  }

  async append(row: Partial<OrderFormDbRow>): Promise<OrderFormDbRow> {
    return orderRow(row)
  }

  async batchAppend(rows: Array<Partial<OrderFormDbRow>>): Promise<OrderFormDbRow[]> {
    return rows.map(orderRow)
  }

  async update(id: string, data: Partial<OrderFormDbRow>): Promise<OrderFormDbRow> {
    this.updateCalls.push({ id, data })
    return orderRow({ id, ...data })
  }

  async delete(): Promise<OrderFormDbRow> {
    return orderRow()
  }
}

function orderRow(overrides: Partial<OrderFormDbRow> = {}): OrderFormDbRow {
  return {
    id: 'order-1',
    order_number: null,
    customer_id: 'CUS-1',
    received_date: '2026-09-22',
    due_date: '2026-09-24',
    service_type: 'WSIR',
    status: 'PENDING',
    quantity: 1,
    hangers: null,
    bags: null,
    hangers_image: null,
    bags_image: null,
    form_image: null,
    note: null,
    timestamp: '2026-09-22 10:00:00',
    created_by: 'staff-1',
    updated_at: null,
    updated_by: null,
    invoice_id: null,
    order_name: null,
    order_description: null,
    ...overrides,
  }
}

const repository = new RecordingRepository()
repository.readRows = [orderRow()]
const timestamp = '2026-10-08 12:34:56'
const openRows = [
  { id: 'pending-null', status: 'Pending' as const, deleted_at: null, started_at: null, scanned_by: 'old-worker', work_minutes: 12, department: 'Logistics' as const, scope: 'ORDER' as const },
  { id: 'pending-empty', status: 'Pending' as const, deleted_at: '', started_at: '', work_minutes: 8, department: 'Packaging' as const, scope: 'ORDER' as const },
  { id: 'in-progress', status: 'In Progress' as const, started_at: '2026-10-07 09:00:00', work_minutes: 15, scanned_by: 'ironer', department: 'Ironing' as const, scope: 'ITEM' as const },
  { id: 'completed', status: 'Completed' as const },
  { id: 'cancelled', status: 'Cancelled' as const },
  { id: 'deleted', status: 'Pending' as const, deleted_at: '2026-10-07 09:00:00' },
]
let reads = 0
let batches = 0
let earnWrites = 0
let failure: 'read' | 'write' | null = null
const service = new WorkOrderService({
  orderFormRepository: () => repository,
  now: () => new Date('2026-10-08T05:34:56Z'),
  jobTicketCompletionRepository: () => ({ async read(query) {
    reads++
    assert.deepEqual(query, { where: { order_id: 'order-1' } })
    if (failure === 'read') throw new Error('read failed')
    return openRows
  }, async updateMany(updates) {
    batches++
    assert.deepEqual(updates, [
      { keyValue: 'pending-null', patch: { status: 'Completed', completed_at: timestamp, started_at: timestamp, updated_by: 'driver' } },
      { keyValue: 'pending-empty', patch: { status: 'Completed', completed_at: timestamp, started_at: timestamp, updated_by: 'driver' } },
      { keyValue: 'in-progress', patch: { status: 'Completed', completed_at: timestamp, updated_by: 'driver' } },
    ])
    assert.ok(updates.every(update => !('scanned_by' in update.patch)))
    if (failure === 'write') throw new Error('write failed')
    return []
  } }),
  workTransactionRepository: () => ({ async batchAppend() { earnWrites++; return [] } }),
  jobTicketRepository: () => ({ async read() { return [] }, async batchAppend() { throw new Error('unexpected provisioning') } }),
  laundryPhotoRepository: () => ({ async read() { return [] } }),
  orderItemRepository: () => ({ async read() { return [] } }),
  workRateRepository: () => ({ async read() { return [] } }),
  staffReader: async () => new Map(),
})
const result = await service.update('order-1', { status: 'COMPLETED', updatedBy: 'driver' })
assert.equal(result.status, 'COMPLETED')
assert.deepEqual(result.ticketProvisioning, { ticketsCreated: 0, scoreFailed: 0, skippedGarments: [], failure: null })
assert.equal(batches, 1)
assert.equal(earnWrites, 0)
const originalError = console.error
const logs: unknown[][] = []
try {
  console.error = (...args) => logs.push(args)
  for (const mode of ['read', 'write'] as const) {
    failure = mode
    assert.deepEqual(await service.update('order-1', { status: 'COMPLETED', updatedBy: 'driver' }), result)
  }
} finally { console.error = originalError }
assert.equal(logs.length, 2)
assert.ok(logs.every(args => args[0] === 'Failed to close open tickets for completed order'))
assert.equal(earnWrites, 0)
const beforeReads = reads
const beforeBatches = batches
await service.update('order-1', { status: 'APPROVED', updatedBy: 'driver' })
await service.update('order-1', { status: 'CANCELLED', updatedBy: 'driver' })
assert.equal(reads, beforeReads)
assert.equal(batches, beforeBatches)
assert.equal(earnWrites, 0)
const emptyService = new WorkOrderService({
  orderFormRepository: () => repository,
  jobTicketCompletionRepository: () => ({ async read() { return [] }, async updateMany() { throw new Error('unexpected empty batch') } }),
})
await emptyService.update('order-1', { status: 'COMPLETED', updatedBy: 'driver' })
console.log('work-order completed dry test passed')
