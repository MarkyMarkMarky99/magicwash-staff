import assert from 'node:assert/strict'
import { z } from 'zod'

import { orderItemResponseSchema } from '../../../../../contracts/order-items/order-item-api.schema.js'
import { workOrderApiContract } from '../../../../../contracts/work-orders/work-order-api.schema.js'
import { WorkOrderService, type OrderItemPort } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormFieldMap } from '../../../../../server/modules/work-orders/work-order.mapping.js'
import { orderFormDbContract, orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

type OrderFormDbRow = z.infer<typeof orderFormRowSchema>
type OrderItemResponse = z.infer<typeof orderItemResponseSchema>

interface FakeOrderRepository extends SheetRepositoryContract<OrderFormDbRow> {
  readRows: Array<Partial<OrderFormDbRow>>
  readQueries: Array<unknown>
}

function makeOrderRow(overrides: Partial<OrderFormDbRow> = {}): OrderFormDbRow {
  return {
    id: 'order-1',
    order_number: null,
    customer_id: 'CUS-1',
    received_date: '2026-08-30',
    due_date: '2026-09-01',
    service_type: 'WSIR',
    status: 'PENDING',
    quantity: 2,
    hangers: 1,
    bags: 0,
    hangers_image: null,
    bags_image: null,
    form_image: null,
    note: null,
    timestamp: '2026-08-30 10:00:00',
    created_by: 'staff-1',
    updated_at: null,
    updated_by: null,
    invoice_id: null,
    order_name: null,
    order_description: null,
    ...overrides,
  }
}

function makeBlankOrderRow(): Partial<OrderFormDbRow> {
  return Object.fromEntries(
    Object.keys(makeOrderRow()).map((key) => [key, null]),
  ) as Partial<OrderFormDbRow>
}

function makeOrderRepository(): FakeOrderRepository {
  const repository: FakeOrderRepository = {
    readRows: [],
    readQueries: [],
    async read(query) {
      repository.readQueries.push(query)
      return repository.readRows
    },
    async append(row) {
      return makeOrderRow(row)
    },
    async batchAppend(rows) {
      return rows.map((row) => makeOrderRow(row))
    },
    async update(_keyValue, patch) {
      return makeOrderRow(patch)
    },
    async delete() {
      return makeOrderRow()
    },
  }
  return repository
}

const expectedFieldMap = {
  id: 'orderId',
  order_number: 'orderNumber',
  customer_id: 'customerId',
  received_date: 'receivedDate',
  due_date: 'dueDate',
  service_type: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  hangers: 'hangers',
  bags: 'bags',
  hangers_image: 'hangersImage',
  bags_image: 'bagsImage',
  form_image: 'formImage',
  note: 'note',
  timestamp: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_id: 'invoiceNumber',
  order_name: 'orderName',
  order_description: 'orderDescription',
} as const

assert.deepEqual(orderFormFieldMap, expectedFieldMap)
assert.equal(orderFormDbContract.primaryKey, 'id')
assert.deepEqual(orderFormDbContract.audit, {
  onAppend: ['timestamp'],
  onUpdate: ['updated_at'],
})
assert.deepEqual(orderFormDbContract.writes, {
  append: true,
  update: true,
  delete: false,
})
assert.equal('update' in workOrderApiContract.response, true)

const orderRepository = makeOrderRepository()
const embeddedItems: OrderItemResponse[] = [
  {
    orderItemId: 'item-row-1',
    orderId: 'order-1',
    itemId: 'shirt-1',
    description: 'shirt',
    quantity: 1,
    price: 25,
    creditsUsed: null,
    serviceType: 'WSIR',
    specialInstructions: null,
    createdAt: '2026-08-30 10:00:00',
    createdBy: 'staff-1',
  },
]
const itemPortCalls: string[] = []
const itemPort: OrderItemPort = {
  async listByOrderId(orderId) {
    itemPortCalls.push(orderId)
    return embeddedItems
  },
}

const service = new WorkOrderService({
  orderFormRepository: () => orderRepository,
  orderItemPort: itemPort,
})

orderRepository.readRows = [makeOrderRow({ customer_id: 'CUS-1' })]
const singleCustomerList = await service.list({
  keyword: 'INV-1',
  customerId: 'CUS-1',
  page: 2,
  perPage: 7,
  sortBy: 'receivedDate',
  sortOrder: 'asc',
})
assert.deepEqual(singleCustomerList.pagination, { page: 2, perPage: 7 })
assert.deepEqual(
  (orderRepository.readQueries[0] as { where?: unknown }).where,
  { customer_id: 'CUS-1' },
)
assert.deepEqual(
  (orderRepository.readQueries[0] as { pagination?: unknown }).pagination,
  { page: 2, perPage: 7 },
)
assert.deepEqual(
  (orderRepository.readQueries[0] as { search?: unknown }).search,
  {
    keyword: 'INV-1',
    fields: ['id', 'order_number', 'customer_id', 'invoice_id'],
  },
)
orderRepository.readRows = [
  makeBlankOrderRow(),
  makeOrderRow({ id: 'order-good', customer_id: 'CUS-1' }),
]
const blankRowList = await service.list({ page: 3, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.equal(blankRowList.items.length, 1)
assert.equal(blankRowList.items[0]?.orderId, 'order-good')
assert.deepEqual(blankRowList.pagination, { page: 3, perPage: 5 })

orderRepository.readRows = [makeOrderRow({ id: 'order-no-customer', customer_id: null as unknown as string })]
const blankCustomerList = await service.list({ page: 1, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.equal(blankCustomerList.items.length, 1)
assert.equal(blankCustomerList.items[0]?.orderId, 'order-no-customer')
assert.equal(blankCustomerList.items[0]?.customerId, '')

orderRepository.readRows = [makeOrderRow({ id: 'order-1', customer_id: 'CUS-1' })]
const detail = await service.getById('order-1')
assert.deepEqual(detail.items, embeddedItems)
assert.equal(detail.createdAt, '2026-08-30 10:00:00')
assert.equal('hangers' in detail, false)
assert.equal('bags' in detail, false)
assert.deepEqual(itemPortCalls, ['order-1'])

orderRepository.readRows = []
await assert.rejects(
  () => service.getById('unknown-order'),
  (error: unknown) => error instanceof ApiError && error.status === 404,
)
assert.equal(
  (orderRepository.readQueries.at(-1) as { id?: unknown } | undefined)?.id,
  'unknown-order',
)
await assert.rejects(
  () => service.getById('   '),
  (error: unknown) => error instanceof ApiError && error.status === 400,
)
assert.equal(
  (orderRepository.readQueries.at(-1) as { id?: unknown } | undefined)?.id,
  'unknown-order',
)

console.log('work-order service dry test passed')
