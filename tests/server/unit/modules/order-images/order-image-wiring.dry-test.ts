import assert from 'node:assert/strict'
import { z } from 'zod'

import { orderImageApiContract } from '../../../../../contracts/order-images/order-image-api.schema.js'
import {
  orderImagesRowSchema,
} from '../../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'

type OrderImagesDbRow = z.infer<typeof orderImagesRowSchema>
type OrderImageAppendFixture = Omit<Partial<OrderImagesDbRow>, 'id'> & { id?: string | null }

interface FakeRepository extends SheetRepositoryContract<OrderImagesDbRow> {
  readRows: OrderImagesDbRow[]
  appendRows: Array<Partial<OrderImagesDbRow>>
}

function makeRow(overrides: Partial<OrderImagesDbRow> = {}): OrderImagesDbRow {
  return {
    id: 'image-1',
    customer_id: null,
    delivery_id: null,
    order_id: 'order-1',
    image_type: 'BAG',
    image_path: 'https://storage.example/image.jpg',
    notes: null,
    quantity: null,
    created_at: null,
    created_by: null,
    ...overrides,
  }
}

function makeRepository(): FakeRepository {
  const repository = {
    readRows: [] as OrderImagesDbRow[],
    appendRows: [] as Array<Partial<OrderImagesDbRow>>,
    async read() {
      return repository.readRows
    },
    async append(row: Partial<OrderImagesDbRow>) {
      const persisted = { ...row, id: row.id ?? 'deadbeef' }
      repository.appendRows.push(persisted)
      return makeRow(persisted)
    },
    async batchAppend(rows: Array<Partial<OrderImagesDbRow>>) {
      return rows.map((row) => makeRow({ ...row, id: row.id ?? 'deadbeef' }))
    },
    async update() {
      throw new Error('not used')
    },
    async delete() {
      throw new Error('not used')
    },
  }
  return repository as FakeRepository
}

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID
const orderImageModule = await import(
  '../../../../../server/modules/order-images/order-image.module.js'
)
if (previousSpreadsheetId === undefined) {
  delete process.env.ORDERS_SPREADSHEET_ID
} else {
  process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
}

const {
  OrderImageService,
  createOrderImageId,
  createOrderImageRepository,
  orderImageService,
  orderImageFieldMap,
  orderImageRoutes,
} = orderImageModule

assert.equal(OrderImageService.prototype instanceof BaseCrudService, true)
assert.deepEqual(Object.getOwnPropertyNames(OrderImageService.prototype), ['constructor'])
assert.ok(orderImageService instanceof OrderImageService)
assert.deepEqual(orderImageFieldMap, {
  id: 'orderImageId',
  customer_id: 'customerId',
  delivery_id: 'deliveryId',
  order_id: 'orderId',
  image_type: 'imageType',
  image_path: 'imagePath',
  notes: 'notes',
  quantity: 'quantity',
  created_at: 'createdAt',
  created_by: 'createdBy',
})
assert.match(createOrderImageId(), /^[0-9a-f]{8}$/)

assert.ok(orderImageRoutes.collection)
assert.ok(orderImageRoutes.item)
assert.equal('update' in orderImageApiContract.response, false)

const collectionDelete = await orderImageRoutes.collection.handleRequest({
  method: 'DELETE',
  query: {},
  body: undefined,
  headers: {},
  params: {},
})
assert.equal(collectionDelete.status, 405)
assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

const itemDelete = await orderImageRoutes.item!.handleRequest({
  method: 'DELETE',
  query: {},
  body: undefined,
  headers: {},
  params: { id: 'image-1' },
})
assert.equal(itemDelete.status, 405)
assert.equal(itemDelete.headers?.Allow, 'GET')

process.env.ORDERS_SPREADSHEET_ID = 'order-images-wrapper-dry-test'
const repositoryModule = await import(
  '../../../../../server/sheets/OrderImages/OrderImages.repository.js'
)
const backingRepository = repositoryModule.getOrderImagesRepository() as unknown as Record<string, Function>
const originalMethods = {
  read: backingRepository.read,
  append: backingRepository.append,
  batchAppend: backingRepository.batchAppend,
  update: backingRepository.update,
  delete: backingRepository.delete,
}
const delegatedCalls: Array<{ method: string; value: unknown }> = []
backingRepository.read = async (query: unknown) => {
  delegatedCalls.push({ method: 'read', value: query })
  return []
}
backingRepository.append = async (row: unknown) => {
  delegatedCalls.push({ method: 'append', value: row })
  return makeRow(row as Partial<OrderImagesDbRow>)
}
backingRepository.batchAppend = async (rows: unknown) => {
  delegatedCalls.push({ method: 'batchAppend', value: rows })
  return (rows as Array<Partial<OrderImagesDbRow>>).map((row) => makeRow(row))
}
backingRepository.update = async (id: unknown, patch: unknown) => {
  delegatedCalls.push({ method: 'update', value: [id, patch] })
  return makeRow({ id: String(id), ...(patch as Partial<OrderImagesDbRow>) })
}
backingRepository.delete = async (id: unknown, deletedBy: unknown) => {
  delegatedCalls.push({ method: 'delete', value: [id, deletedBy] })
  return makeRow({ id: String(id) })
}

try {
  const wrapped = createOrderImageRepository()
  const appendFixture = wrapped.append as (row: OrderImageAppendFixture) => Promise<OrderImagesDbRow>
  const readQuery = ReadQueryDTO.fromId<Partial<OrderImagesDbRow>>('image-1')
  await wrapped.read(readQuery)
  await wrapped.append({ order_id: 'order-1' })
  await wrapped.append({ id: 'caller-owned-id', order_id: 'order-1' })
  await appendFixture({ id: null, order_id: 'order-1' })
  await wrapped.append({ id: '', order_id: 'order-1' })
  await wrapped.append({ id: '   ', order_id: 'order-1' })
  await wrapped.batchAppend([{ order_id: 'order-1' }, { order_id: 'order-1' }])
  await wrapped.update('image-1', { notes: 'updated' })
  await wrapped.delete('image-1', 'staff-1')
} finally {
  backingRepository.read = originalMethods.read
  backingRepository.append = originalMethods.append
  backingRepository.batchAppend = originalMethods.batchAppend
  backingRepository.update = originalMethods.update
  backingRepository.delete = originalMethods.delete
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

assert.deepEqual(
  delegatedCalls.map((call) => call.method),
  ['read', 'append', 'append', 'append', 'append', 'append', 'batchAppend', 'update', 'delete'],
)
assert.deepEqual(delegatedCalls[0]!.value, ReadQueryDTO.fromId('image-1'))
assert.match(String((delegatedCalls[1]!.value as Record<string, unknown>).id), /^[0-9a-f]{8}$/)
assert.equal('created_at' in (delegatedCalls[1]!.value as Record<string, unknown>), false)
assert.equal((delegatedCalls[2]!.value as Record<string, unknown>).id, 'caller-owned-id')
assert.equal('created_at' in (delegatedCalls[2]!.value as Record<string, unknown>), false)
assert.match(String((delegatedCalls[3]!.value as Record<string, unknown>).id), /^[0-9a-f]{8}$/)
assert.match(String((delegatedCalls[4]!.value as Record<string, unknown>).id), /^[0-9a-f]{8}$/)
assert.match(String((delegatedCalls[5]!.value as Record<string, unknown>).id), /^[0-9a-f]{8}$/)
const wrappedBatch = delegatedCalls[6]!.value as Array<Record<string, unknown>>
assert.equal(wrappedBatch.length, 2)
assert.ok(wrappedBatch.every((row) => /^[0-9a-f]{8}$/.test(String(row.id))))
assert.notEqual(wrappedBatch[0]!.id, wrappedBatch[1]!.id)
assert.deepEqual(delegatedCalls[7]!.value, ['image-1', { notes: 'updated' }])
assert.deepEqual(delegatedCalls[8]!.value, ['image-1', 'staff-1'])

const repository = makeRepository()
repository.readRows = [
  makeRow({ id: 'image-1', order_id: 'order-1', quantity: 0, notes: null }),
  makeRow({ id: 'image-2', order_id: 'other-order', quantity: 1, notes: 'second image' }),
]
const service = new OrderImageService({ repository })

const pagination = { page: 2, perPage: 2 }
const listed = await service.list({ orderId: 'order-1', ...pagination })
assert.deepEqual(
  listed.items.map((item: { orderImageId: string }) => item.orderImageId),
  ['image-1', 'image-2'],
  'list must return every repository row without applying an extra filter',
)
assert.deepEqual(
  listed.items.map((item: { orderImageId: string; quantity: number | null; notes: string | null }) => ({
    orderImageId: item.orderImageId,
    quantity: item.quantity,
    notes: item.notes,
  })),
  [
    { orderImageId: 'image-1', quantity: 0, notes: null },
    { orderImageId: 'image-2', quantity: 1, notes: 'second image' },
  ],
)
assert.deepEqual(listed.pagination, pagination)

await service.create({
  orderId: 'order-1',
  customerId: 'customer-1',
  deliveryId: 'delivery-1',
  imageType: 'WEIGHT',
  imagePath: 'https://storage.example/weight.jpg',
  notes: null,
  quantity: 2.75,
  createdBy: 'staff-1',
})
const withDelivery = repository.appendRows[0]!
assert.match(String(withDelivery.id), /^[0-9a-f]{8}$/)
assert.equal(withDelivery.delivery_id, 'delivery-1')
assert.equal('created_at' in withDelivery, false)

await service.create({
  orderId: 'order-1',
  imageType: 'BAG',
  imagePath: 'https://storage.example/bag.jpg',
  createdBy: 'staff-1',
})
const withoutDelivery = repository.appendRows[1]!
assert.match(String(withoutDelivery.id), /^[0-9a-f]{8}$/)
assert.equal('delivery_id' in withoutDelivery, false)
assert.equal('created_at' in withoutDelivery, false)

console.log('order-image module wiring dry test passed')
