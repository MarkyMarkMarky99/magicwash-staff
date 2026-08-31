import assert from 'node:assert/strict'
import { z } from 'zod'
import { orderItemResponseSchema } from '../../../../../contracts/order-items/order-item-api.schema.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { API_ERROR_CODES } from '../../../../../contracts/shared/api.schema.js'

type OrderItemFormsDbRow = z.infer<typeof import('../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js').orderItemFormsRowSchema>
type OrderFormDbRow = z.infer<typeof orderFormRowSchema>
type ItemReadRow = Omit<Partial<OrderItemFormsDbRow>, 'id'> & { id?: string | null }

interface FakeItemRepository extends SheetRepositoryContract<OrderItemFormsDbRow> {
  events: string[]
  readRows: Array<ItemReadRow>
  readQueries: Array<unknown>
  appendRows: Array<Partial<OrderItemFormsDbRow>>
  batchAppendRows: Array<Array<Partial<OrderItemFormsDbRow>>>
}
interface FakeOrderRepository extends SheetRepositoryContract<OrderFormDbRow> {
  events: string[]
  readRows: Array<Partial<OrderFormDbRow>>
  readQueries: Array<unknown>
}

function makeItemRepository(): FakeItemRepository {
  const repository = {
    readRows: [] as Array<Partial<OrderItemFormsDbRow>>,
    events: [] as string[],
    readQueries: [] as Array<unknown>,
    appendRows: [] as Array<Partial<OrderItemFormsDbRow>>,
    batchAppendRows: [] as Array<Array<Partial<OrderItemFormsDbRow>>>,
    async read(query?: unknown) { repository.events.push('item-read'); repository.readQueries.push(query); return repository.readRows },
    async append(row: Partial<OrderItemFormsDbRow>) {
      repository.events.push('item-append'); repository.appendRows.push(row)
      return { ...row, credits_used: row.credits_used ?? null, timestamp: row.timestamp ?? null,
        updated_at: row.updated_at ?? null, updated_by: row.updated_by ?? null, invoice_item_id: row.invoice_item_id ?? null } as OrderItemFormsDbRow
    },
    async batchAppend(rows: Array<Partial<OrderItemFormsDbRow>>) { repository.events.push('item-batchAppend'); repository.batchAppendRows.push(rows); return rows as OrderItemFormsDbRow[] },
    async update() { throw new Error('not used') },
    async delete() { throw new Error('not used') },
  }
  return repository as FakeItemRepository
}

function makeOrderRepository(): FakeOrderRepository {
  const repository = {
    readRows: [] as Array<Partial<OrderFormDbRow>>,
    events: [] as string[],
    readQueries: [] as Array<unknown>,
    async read(query?: unknown) { repository.events.push('order-read'); repository.readQueries.push(query); return repository.readRows },
    async append() { throw new Error('not used') },
    async batchAppend() { throw new Error('not used') },
    async update() { throw new Error('not used') },
    async delete() { throw new Error('not used') },
  }
  return repository as FakeOrderRepository
}

const orderItemModule = await import('../../../../../server/modules/order-items/order-item.module.js')
const { OrderItemService } = orderItemModule
const itemRepository = makeItemRepository()
const orderRepository = makeOrderRepository()
const service = new OrderItemService({ repository: itemRepository, orderFormRepository: () => orderRepository })

itemRepository.readRows = [
  { id: '', order_id: 'order-1', quantity: 0 },
  { id: null, order_id: 'order-1', quantity: 0 },
  { id: 'fc60a477', order_id: 'order-1', item_id: 'item-1', description: 'shirt', quantity: 2,
    price: 25, credits_used: 1, timestamp: '2026-08-30 10:00:00',
    service_type: '\u0e0b\u0e31\u0e01\u0e23\u0e35\u0e14', special_instructions: 'fold', created_by: 'staff-1' },
]
const listed = await service.list({ keyword: '', orderId: 'order-1', page: 2, perPage: 5, sortBy: 'createdAt', sortOrder: 'desc' })
assert.deepEqual(listed, {
  items: [{ orderItemId: 'fc60a477', orderId: 'order-1', itemId: 'item-1', description: 'shirt', quantity: 2,
    price: 25, creditsUsed: 1, serviceType: '\u0e0b\u0e31\u0e01\u0e23\u0e35\u0e14', specialInstructions: 'fold',
    createdAt: '2026-08-30 10:00:00', createdBy: 'staff-1' }],
  pagination: { page: 2, perPage: 5 },
})

const parentServiceType = '\u0e23\u0e35\u0e14\u0e1c\u0e49\u0e32'
orderRepository.readRows = [{ id: 'order-1', service_type: parentServiceType as unknown as OrderFormDbRow['service_type'] }]
const created = await service.create({ orderId: 'order-1', itemId: 'item-from-request', description: 'trousers', quantity: 3,
  price: 30, specialInstructions: 'hang', createdBy: 'staff-2', serviceType: 'CLIENT-SUPPLIED' })
assert.deepEqual(orderRepository.readQueries, [ReadQueryDTO.fromId('order-1')])
assert.deepEqual(orderRepository.events, ['order-read'])
assert.deepEqual(itemRepository.events, ['item-read', 'item-append'])
assert.equal(itemRepository.appendRows.length, 1)
const appended = itemRepository.appendRows[0]!
assert.match(appended.id ?? '', /^[0-9a-f]{8}$/)
assert.equal(appended.order_id, 'order-1')
assert.equal(appended.item_id, 'item-from-request')
assert.equal(appended.service_type, parentServiceType)
assert.equal('timestamp' in appended, false)
assert.equal('serviceType' in appended, false)
assert.deepEqual(Object.keys(created).sort(), Object.keys(orderItemResponseSchema.shape).sort())
assert.equal(created.serviceType, parentServiceType)

const missingItemRepository = makeItemRepository()
const missingOrderRepository = makeOrderRepository()
const missingService = new OrderItemService({ repository: missingItemRepository, orderFormRepository: () => missingOrderRepository })
await assert.rejects(
  () => missingService.create({ orderId: 'order-404', itemId: 'item-1', description: 'shirt', quantity: 1,
    price: null, specialInstructions: null, createdBy: 'staff-1' }),
  (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, API_ERROR_CODES.NOT_FOUND)
    assert.equal(error.status, 404)
    assert.equal(error.message, "Resource 'order-404' not found")
    return true
  },
)
assert.equal(missingItemRepository.appendRows.length, 0)

const rowsForBatch = [{ order_id: 'order-1', item_id: 'item-1', quantity: 1 }, { order_id: 'order-1', item_id: 'item-2', quantity: 2 }]
await service.createMany(rowsForBatch)
assert.equal(itemRepository.batchAppendRows.length, 1)
assert.deepEqual(itemRepository.batchAppendRows[0], rowsForBatch)

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
process.env.ORDERS_SPREADSHEET_ID = 'order-item-forms-wrapper-test-spreadsheet'
const formsRepositoryModule = await import(
  '../../../../../server/sheets/OrderItemForms/OrderItemForms.repository.js'
)
const formsRepository = formsRepositoryModule.getOrderItemFormsRepository() as unknown as Record<string, Function>
const originalMethods = {
  append: formsRepository.append,
  batchAppend: formsRepository.batchAppend,
}
const delegatedCalls: Array<{ method: string; value: unknown }> = []
formsRepository.append = async (row: unknown) => {
  delegatedCalls.push({ method: 'append', value: row })
  return row
}
formsRepository.batchAppend = async (rows: unknown) => {
  delegatedCalls.push({ method: 'batchAppend', value: rows })
  return rows
}

try {
  const wrapped = orderItemModule.createOrderItemRepository()
  await wrapped.append({ order_id: 'order-1' })
  await wrapped.append({ id: 'caller-owned-id', order_id: 'order-1' })
  await wrapped.batchAppend([{ order_id: 'order-1' }, { order_id: 'order-1' }])
} finally {
  formsRepository.append = originalMethods.append
  formsRepository.batchAppend = originalMethods.batchAppend
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

assert.deepEqual(delegatedCalls.map((call) => call.method), ['append', 'append', 'batchAppend'])
const wrapperAppend = delegatedCalls[0]!.value as Record<string, unknown>
assert.match(String(wrapperAppend.id), /^[0-9a-f]{8}$/)
assert.equal('timestamp' in wrapperAppend, false)
const preservedAppend = delegatedCalls[1]!.value as Record<string, unknown>
assert.equal(preservedAppend.id, 'caller-owned-id')
assert.equal('timestamp' in preservedAppend, false)
const wrapperBatch = delegatedCalls[2]!.value as Array<Record<string, unknown>>
assert.equal(wrapperBatch.length, 2)
assert.ok(wrapperBatch.every((row) => /^[0-9a-f]{8}$/.test(String(row.id))))
assert.notEqual(wrapperBatch[0]!.id, wrapperBatch[1]!.id)
assert.ok(wrapperBatch.every((row) => !('timestamp' in row)))

console.log('order-item service dry test passed')
