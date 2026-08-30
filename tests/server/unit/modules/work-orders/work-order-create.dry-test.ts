import assert from 'node:assert/strict'
import { z } from 'zod'

import { workOrderApiContract, workOrderCreateResponseSchema } from '../../../../../contracts/work-orders/work-order-api.schema.js'
import {
  WorkOrderService,
  type OrderItemWriter,
} from '../../../../../server/modules/work-orders/work-order.service.js'
import { createCrudRoutes } from '../../../../../server/shared/http/crud-routes.js'
import { orderItemFormsRowSchema } from '../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

type OrderFormDbRow = z.infer<typeof orderFormRowSchema>
type OrderItemFormsDbRow = z.infer<typeof orderItemFormsRowSchema>

interface FakeOrderRepository extends SheetRepositoryContract<OrderFormDbRow> {
  events: string[]
  appendRows: Array<Partial<OrderFormDbRow>>
  shouldFailAppend: boolean
}

interface FakeWriter extends OrderItemWriter {
  events: string[]
  rows: Array<Array<Partial<OrderItemFormsDbRow>>>
  shouldFail: boolean
}

function makeOrderRow(overrides: Partial<OrderFormDbRow> = {}): OrderFormDbRow {
  return {
    id: 'order-1',
    order_number: 'ORD-1001',
    customer_id: 'CUS-1',
    received_date: '2026-08-30',
    due_date: '2026-09-01',
    service_type: 'DRCL',
    status: 'PENDING',
    quantity: 3,
    hangers: 1,
    bags: 1,
    hangers_image: null,
    bags_image: null,
    form_image: null,
    note: 'rush',
    timestamp: '2026-08-30 10:00:00',
    created_by: 'staff-1',
    updated_at: null,
    updated_by: null,
    invoice_id: null,
    order_name: 'Dry cleaning',
    order_description: 'Three garments',
    ...overrides,
  }
}

function makeOrderRepository(events: string[]): FakeOrderRepository {
  const repository: FakeOrderRepository = {
    events,
    appendRows: [],
    shouldFailAppend: false,
    async read() {
      return []
    },
    async append(row) {
      repository.events.push('header append')
      repository.appendRows.push(row)
      if (repository.shouldFailAppend) {
        throw new Error('header append failed')
      }
      return makeOrderRow(row)
    },
    async batchAppend() {
      return []
    },
    async update() {
      return makeOrderRow()
    },
    async delete() {
      return makeOrderRow()
    },
  }
  return repository
}

function makeWriter(events: string[]): FakeWriter {
  const writer: FakeWriter = {
    events,
    rows: [],
    shouldFail: false,
    async createMany(rows) {
      writer.events.push('items createMany')
      writer.rows.push(rows)
      if (writer.shouldFail) {
        throw new Error('items failed to write')
      }
    },
  }
  return writer
}

const payload = {
  customerId: 'CUS-1',
  receivedDate: '2026-08-30',
  dueDate: '2026-09-01',
  serviceType: 'DRCL',
  quantity: 3,
  hangers: 1,
  bags: 1,
  note: 'rush',
  orderName: 'Dry cleaning',
  orderDescription: 'Three garments',
  createdBy: 'staff-1',
  items: [
    {
      itemId: 'shirt-1',
      description: 'shirt',
      quantity: 1,
      price: 25,
      category: 'Tops',
      specialInstructions: 'steam',
    },
    {
      itemId: 'trousers-1',
      description: 'trousers',
      quantity: 2,
      price: 40,
      category: 'Bottoms',
      specialInstructions: null,
    },
  ],
}

const events: string[] = []
const orderRepository = makeOrderRepository(events)
const writer = makeWriter(events)
const service = new WorkOrderService({
  orderFormRepository: () => orderRepository,
  orderItemWriter: writer,
})
const routes = createCrudRoutes(service, workOrderApiContract)
const successfulResult = await routes.collection.handleRequest({
  method: 'POST',
  query: {},
  body: payload,
  headers: {},
  params: {},
})

assert.equal(successfulResult.status, 201)
assert.deepEqual(events, ['header append', 'items createMany'])
assert.equal(orderRepository.appendRows.length, 1)
const header = orderRepository.appendRows[0]!
assert.match(String(header.id), /^[0-9a-f]{8}$/)
assert.equal(header.status, 'PENDING')
assert.equal('timestamp' in header, false)
assert.equal('order_number' in header, false)
assert.equal('invoice_id' in header, false)
assert.equal('hangers_image' in header, false)
assert.equal('bags_image' in header, false)
assert.equal(writer.rows.length, 1)
assert.equal(writer.rows[0]!.length, payload.items.length)
assert.ok(
  writer.rows[0]!.every(
    (row) => row.order_id === header.id && row.service_type === payload.serviceType && row.created_by === payload.createdBy,
  ),
)
const successfulBody = successfulResult.body as { data: Record<string, unknown> }
assert.deepEqual(Object.keys(successfulBody.data).sort(), Object.keys(workOrderCreateResponseSchema.shape).sort())
assert.equal(successfulBody.data.itemsRequested, 2)
assert.equal(successfulBody.data.itemsCreated, 2)
assert.equal(successfulBody.data.itemsFailed, false)
assert.equal(successfulBody.data.itemsError, null)

const failingEvents: string[] = []
const failingOrderRepository = makeOrderRepository(failingEvents)
const failingWriter = makeWriter(failingEvents)
failingWriter.shouldFail = true
const failingService = new WorkOrderService({
  orderFormRepository: () => failingOrderRepository,
  orderItemWriter: failingWriter,
})
const failingRoutes = createCrudRoutes(failingService, workOrderApiContract)
const failedItemsResult = await failingRoutes.collection.handleRequest({
  method: 'POST',
  query: {},
  body: payload,
  headers: {},
  params: {},
})
assert.equal(failedItemsResult.status, 201)
const failedItemsBody = failedItemsResult.body as { data: Record<string, unknown> }
assert.equal(failedItemsBody.data.itemsRequested, 2)
assert.equal(failedItemsBody.data.itemsCreated, 0)
assert.equal(failedItemsBody.data.itemsFailed, true)
assert.equal(failedItemsBody.data.itemsError, 'items failed to write')

const emptyEvents: string[] = []
const emptyOrderRepository = makeOrderRepository(emptyEvents)
const emptyWriter = makeWriter(emptyEvents)
const emptyService = new WorkOrderService({
  orderFormRepository: () => emptyOrderRepository,
  orderItemWriter: emptyWriter,
})
const emptyResponse = await emptyService.create({ ...payload, items: [] })
assert.equal(emptyResponse.itemsRequested, 0)
assert.equal(emptyResponse.itemsCreated, 0)
assert.equal(emptyResponse.itemsFailed, false)
assert.equal(emptyResponse.itemsError, null)
assert.equal(emptyWriter.rows.length, 0)

const headerFailureEvents: string[] = []
const headerFailureRepository = makeOrderRepository(headerFailureEvents)
headerFailureRepository.shouldFailAppend = true
const headerFailureWriter = makeWriter(headerFailureEvents)
const headerFailureService = new WorkOrderService({
  orderFormRepository: () => headerFailureRepository,
  orderItemWriter: headerFailureWriter,
})
await assert.rejects(
  () => headerFailureService.create(payload),
  /header append failed/,
)
assert.deepEqual(headerFailureEvents, ['header append'])
assert.equal(headerFailureWriter.rows.length, 0)

console.log('work-order create dry test passed')
