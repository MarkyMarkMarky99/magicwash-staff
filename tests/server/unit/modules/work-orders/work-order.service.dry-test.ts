import assert from 'node:assert/strict'
import { z } from 'zod'

import { orderItemResponseSchema } from '../../../../../contracts/order-items/order-item-api.schema.js'
import { workOrderApiContract } from '../../../../../contracts/work-orders/work-order-api.schema.js'
import { WorkOrderService, type OrderItemPort } from '../../../../../server/modules/work-orders/work-order.service.js'
import { orderFormFieldMap } from '../../../../../server/modules/work-orders/work-order.mapping.js'
import { customersRowSchema } from '../../../../../server/sheets/Customers/Customers.db-contract.js'
import { orderFormDbContract, orderFormRowSchema } from '../../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

type OrderFormDbRow = z.infer<typeof orderFormRowSchema>
type CustomersDbRow = z.infer<typeof customersRowSchema>
type OrderItemResponse = z.infer<typeof orderItemResponseSchema>

interface FakeOrderRepository extends SheetRepositoryContract<OrderFormDbRow> {
  readRows: Array<Partial<OrderFormDbRow>>
  readQueries: Array<unknown>
}

interface FakeCustomerRepository extends SheetRepositoryContract<CustomersDbRow> {
  readRows: Array<Partial<CustomersDbRow>>
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

function makeCustomerRow(overrides: Partial<CustomersDbRow> = {}): CustomersDbRow {
  return {
    Timestamp: '2026-08-30 10:00:00',
    CustomerID: 'CUS-1',
    CustomerIndex: '1',
    CustomerName: 'First customer',
    Phone: null,
    Address: null,
    Location: null,
    RegisteredDate: null,
    Facebook: null,
    Line: null,
    Whatsapp: null,
    Email: null,
    CustomerType: null,
    Source: null,
    ScheduledDays: null,
    LastVisitDate: null,
    PreferredContactMethod: null,
    UpdatedAt: null,
    UpdatedBy: null,
    DeletedAt: null,
    ...overrides,
  }
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

function makeCustomerRepository(): FakeCustomerRepository {
  const repository: FakeCustomerRepository = {
    readRows: [],
    readQueries: [],
    async read(query) {
      repository.readQueries.push(query)
      return repository.readRows
    },
    async append() {
      return makeCustomerRow()
    },
    async batchAppend(rows) {
      return rows.map((row) => makeCustomerRow(row))
    },
    async update() {
      return makeCustomerRow()
    },
    async delete() {
      return makeCustomerRow()
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
assert.equal('update' in workOrderApiContract.response, false)

const orderRepository = makeOrderRepository()
const customerRepository = makeCustomerRepository()
const embeddedItems: OrderItemResponse[] = [
  {
    orderItemId: 'item-row-1',
    orderId: 'order-1',
    itemId: 'shirt-1',
    description: 'shirt',
    quantity: 1,
    price: 25,
    creditsUsed: null,
    category: 'Tops',
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
  customerRepository: () => customerRepository,
  orderItemPort: itemPort,
})

orderRepository.readRows = [makeOrderRow({ customer_id: 'CUS-1' })]
customerRepository.readRows = [
  makeCustomerRow({ CustomerID: ' CUS-1 ', CustomerName: 'First customer' }),
  makeCustomerRow({ CustomerID: 'CUS-1', CustomerName: 'Duplicate customer' }),
]
const singleCustomerList = await service.list({
  keyword: 'INV-1',
  customerId: 'CUS-1',
  page: 2,
  perPage: 7,
  sortBy: 'receivedDate',
  sortOrder: 'asc',
})
assert.equal(singleCustomerList.items[0]?.customerName, 'First customer')
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
assert.deepEqual(
  (customerRepository.readQueries[0] as { where?: unknown }).where,
  { CustomerID: 'CUS-1' },
)

orderRepository.readRows = [makeOrderRow({ customer_id: 'CUS-MISSING' })]
customerRepository.readRows = [makeCustomerRow()]
const missingCustomerList = await service.list({ page: 1, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.equal(missingCustomerList.items[0]?.customerName, '')
assert.equal(missingCustomerList.items.length, 1)
assert.deepEqual(
  (customerRepository.readQueries[1] as { where?: unknown }).where,
  { CustomerID: 'CUS-MISSING' },
)

orderRepository.readRows = [
  makeOrderRow({ id: 'order-1', customer_id: 'CUS-1' }),
  makeOrderRow({ id: 'order-2', customer_id: 'CUS-2' }),
]
customerRepository.readRows = [
  makeCustomerRow({ CustomerID: 'CUS-1', CustomerName: 'Customer one' }),
  makeCustomerRow({ CustomerID: 'CUS-2', CustomerName: 'Customer two' }),
]
const multiCustomerList = await service.list({ page: 1, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.deepEqual(multiCustomerList.items.map((item) => item.customerName), [
  'Customer one',
  'Customer two',
])
assert.deepEqual((customerRepository.readQueries[2] as { where?: unknown }).where, {})

orderRepository.readRows = [
  makeBlankOrderRow(),
  makeOrderRow({ id: 'order-good', customer_id: 'CUS-1' }),
]
customerRepository.readRows = [makeCustomerRow({ CustomerID: 'CUS-1', CustomerName: 'Customer one' })]
const blankRowList = await service.list({ page: 3, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.equal(blankRowList.items.length, 1)
assert.equal(blankRowList.items[0]?.orderId, 'order-good')
assert.equal(blankRowList.items[0]?.customerName, 'Customer one')
assert.deepEqual(blankRowList.pagination, { page: 3, perPage: 5 })

const customerReadsBeforeBlankCustomer = customerRepository.readQueries.length
orderRepository.readRows = [makeOrderRow({ id: 'order-no-customer', customer_id: null as unknown as string })]
customerRepository.readRows = []
const blankCustomerList = await service.list({ page: 1, perPage: 5, sortBy: 'receivedDate', sortOrder: 'desc' })
assert.equal(blankCustomerList.items.length, 1)
assert.equal(blankCustomerList.items[0]?.orderId, 'order-no-customer')
assert.equal(blankCustomerList.items[0]?.customerId, '')
assert.equal(blankCustomerList.items[0]?.customerName, '')
assert.equal(customerRepository.readQueries.length, customerReadsBeforeBlankCustomer)

orderRepository.readRows = [makeOrderRow({ id: 'order-1', customer_id: 'CUS-1' })]
customerRepository.readRows = [makeCustomerRow({ CustomerID: 'CUS-1', CustomerName: 'Customer one' })]
const detail = await service.getById('order-1')
assert.deepEqual(detail.items, embeddedItems)
assert.equal(detail.customerName, 'Customer one')
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
