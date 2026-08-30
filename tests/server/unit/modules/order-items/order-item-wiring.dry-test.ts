import assert from 'node:assert/strict'
import { z } from 'zod'

import { orderItemApiContract } from '../../../../../contracts/order-items/order-item-api.schema.js'
import { orderItemFormsDbContract } from '../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'

type OrderItemFormsDbRow = z.infer<
  typeof import('../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js').orderItemFormsRowSchema
>

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID

const orderItemModule = await import(
  '../../../../../server/modules/order-items/order-item.module.js'
)

if (previousSpreadsheetId === undefined) {
  delete process.env.ORDERS_SPREADSHEET_ID
} else {
  process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
}

const {
  OrderItemService,
  createOrderItemId,
  createOrderItemRepository,
  orderItemFieldMap,
  orderItemRoutes,
  orderItemService,
} = orderItemModule

assert.ok(orderItemService instanceof OrderItemService)
assert.ok(OrderItemService.prototype instanceof BaseCrudService)
assert.equal(orderItemFormsDbContract.primaryKey, 'id')
assert.equal(orderItemFormsDbContract.sheetName, 'OrderItemForms')
assert.equal(orderItemFormsDbContract.spreadsheetId, 'ORDERS_SPREADSHEET_ID')
assert.deepEqual(orderItemFormsDbContract.audit, { onAppend: ['timestamp'], onUpdate: [] })
assert.deepEqual(orderItemFormsDbContract.writes, {
  append: true,
  update: false,
  delete: false,
})
assert.equal('valueInput' in orderItemFormsDbContract, false)
assert.deepEqual(orderItemFieldMap, {
  id: 'orderItemId',
  order_id: 'orderId',
  item_id: 'itemId',
  description: 'description',
  quantity: 'quantity',
  price: 'price',
  credits_used: 'creditsUsed',
  timestamp: 'createdAt',
  category: 'category',
  service_type: 'serviceType',
  special_instructions: 'specialInstructions',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_item_id: 'invoiceItemId',
})
assert.match(createOrderItemId(), /^[0-9a-f]{8}$/)

assert.ok(orderItemRoutes.collection)
assert.ok(orderItemRoutes.item)
assert.equal('update' in orderItemApiContract.response, false)

const collectionDelete = await orderItemRoutes.collection.handleRequest({
  method: 'DELETE',
  query: {},
  body: undefined,
  headers: {},
  params: {},
})
assert.equal(collectionDelete.status, 405)
assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

const itemDelete = await orderItemRoutes.item!.handleRequest({
  method: 'DELETE',
  query: {},
  body: undefined,
  headers: {},
  params: { id: 'item-1' },
})
assert.equal(itemDelete.status, 405)
assert.equal(itemDelete.headers?.Allow, 'GET')

const itemPatch = await orderItemRoutes.item!.handleRequest({
  method: 'PATCH',
  query: {},
  body: undefined,
  headers: {},
  params: { id: 'item-1' },
})
assert.equal(itemPatch.status, 405)
assert.equal(itemPatch.headers?.Allow, 'GET')

process.env.ORDERS_SPREADSHEET_ID = 'order-item-forms-wrapper-test-spreadsheet'
const formsRepositoryModule = await import(
  '../../../../../server/sheets/OrderItemForms/OrderItemForms.repository.js'
)
const formsRepository = formsRepositoryModule.getOrderItemFormsRepository() as unknown as Record<string, Function>
const originalMethods = {
  read: formsRepository.read,
  append: formsRepository.append,
  batchAppend: formsRepository.batchAppend,
  update: formsRepository.update,
  delete: formsRepository.delete,
}
const delegatedCalls: Array<{ method: string; value: unknown }> = []
formsRepository.read = async (query: unknown) => {
  delegatedCalls.push({ method: 'read', value: query })
  return []
}
formsRepository.append = async (row: unknown) => {
  delegatedCalls.push({ method: 'append', value: row })
  return row
}
formsRepository.batchAppend = async (rows: unknown) => {
  delegatedCalls.push({ method: 'batchAppend', value: rows })
  return rows
}
formsRepository.update = async (key: unknown, patch: unknown) => {
  delegatedCalls.push({ method: 'update', value: [key, patch] })
  return {}
}
formsRepository.delete = async (key: unknown, deletedBy: unknown) => {
  delegatedCalls.push({ method: 'delete', value: [key, deletedBy] })
  return {}
}

const readQuery = ReadQueryDTO.fromId<Partial<OrderItemFormsDbRow>>('item-1')
try {
  const wrapped = createOrderItemRepository()
  await wrapped.read(readQuery)
  await wrapped.append({ order_id: 'order-1' })
  await wrapped.batchAppend([{ order_id: 'order-1' }, { order_id: 'order-1' }])
  await wrapped.update('item-1', { quantity: 2 })
  await wrapped.delete('item-1', 'staff-1')
} finally {
  formsRepository.read = originalMethods.read
  formsRepository.append = originalMethods.append
  formsRepository.batchAppend = originalMethods.batchAppend
  formsRepository.update = originalMethods.update
  formsRepository.delete = originalMethods.delete
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

assert.deepEqual(
  delegatedCalls.map((call) => call.method),
  ['read', 'append', 'batchAppend', 'update', 'delete'],
)
assert.deepEqual(delegatedCalls[0]!.value, readQuery)
assert.match(String((delegatedCalls[1]!.value as Record<string, unknown>).id), /^[0-9a-f]{8}$/)
assert.equal('timestamp' in (delegatedCalls[1]!.value as Record<string, unknown>), false)
const batchRows = delegatedCalls[2]!.value as Array<Record<string, unknown>>
assert.equal(batchRows.length, 2)
assert.ok(batchRows.every((row) => /^[0-9a-f]{8}$/.test(String(row.id))))
assert.notEqual(batchRows[0]!.id, batchRows[1]!.id)

console.log('order-item wiring dry test passed')
