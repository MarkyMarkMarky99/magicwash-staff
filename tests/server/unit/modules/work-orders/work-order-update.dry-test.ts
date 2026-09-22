import assert from 'node:assert/strict'
import type { z } from 'zod'

import { WorkOrderService } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

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

function createService(repository: RecordingRepository): WorkOrderService {
  return new WorkOrderService({ orderFormRepository: () => repository })
}

const repository = new RecordingRepository()
const service = createService(repository)

repository.readRows = [orderRow()]
const updated = await service.update('  order-1  ', { status: 'APPROVED', updatedBy: 'staff-2' })
assert.deepEqual(repository.updateCalls, [
  {
    id: 'order-1',
    data: { status: 'APPROVED', updated_by: 'staff-2' },
  },
])
assert.equal('updated_at' in repository.updateCalls[0]!.data, false)
assert.equal(updated.status, 'APPROVED')

await assert.rejects(
  () => service.update('order-1', { status: 'INVALID', updatedBy: 'staff-2' }),
  (error: unknown) => error instanceof ApiError && error.status === 422,
)
assert.equal(repository.updateCalls.length, 1)

repository.readRows = []
await assert.rejects(
  () => service.update('unknown-order', { status: 'APPROVED', updatedBy: 'staff-2' }),
  (error: unknown) => error instanceof ApiError && error.status === 404,
)
assert.equal(repository.updateCalls.length, 1)

console.log('work-order update dry test passed')
