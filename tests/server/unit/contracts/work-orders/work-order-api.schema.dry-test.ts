import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as workOrderModule from '../../../../../contracts/work-orders/work-order-api.schema.js'
import { API_PAGINATION_DEFAULTS } from '../../../../../contracts/shared/api.schema.js'

const {
  MAX_WORK_ORDERS_PER_PAGE,
  workOrderApiContract,
  workOrderCreateItemSchema,
  workOrderCreateResponseSchema,
  workOrderCreateSchema,
  workOrderDetailResponseSchema,
  workOrderListQuerySchema,
  workOrderListResponseSchema,
  workOrderUpdateSchema,
} = workOrderModule

const LIST_RESPONSE_FIELDS = [
  'orderId', 'customerId', 'customerName', 'orderNumber', 'invoiceNumber', 'receivedDate',
  'dueDate', 'serviceType', 'status', 'quantity', 'hangers', 'bags', 'note', 'createdAt',
] as const

const DETAIL_RESPONSE_FIELDS = [
  ...LIST_RESPONSE_FIELDS, 'orderName', 'orderDescription', 'formImage', 'hangersImage',
  'bagsImage', 'createdBy', 'items',
] as const

const CREATE_RESPONSE_FIELDS = [
  'orderId', 'orderNumber', 'customerId', 'receivedDate', 'dueDate', 'serviceType', 'status',
  'quantity', 'note', 'createdAt', 'createdBy', 'itemsRequested', 'itemsCreated', 'itemsFailed',
  'itemsError',
] as const

assert.equal(MAX_WORK_ORDERS_PER_PAGE, 500)
assert.deepEqual(new Set(Object.keys(workOrderModule)), new Set([
  'MAX_WORK_ORDERS_PER_PAGE',
  'workOrderApiContract',
  'workOrderCreateItemSchema',
  'workOrderCreateResponseSchema',
  'workOrderCreateSchema',
  'workOrderDetailResponseSchema',
  'workOrderListQuerySchema',
  'workOrderListResponseSchema',
  'workOrderUpdateSchema',
]))

assert.deepEqual(Object.keys(workOrderApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(workOrderApiContract.query), ['list'])
assert.deepEqual(Object.keys(workOrderApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(workOrderApiContract.response), ['list', 'detail', 'create'])
assert.equal(workOrderApiContract.query.list, workOrderListQuerySchema)
assert.equal(workOrderApiContract.request?.create, workOrderCreateSchema)
assert.equal(workOrderApiContract.request?.update, workOrderUpdateSchema)
assert.equal(workOrderApiContract.response.list, workOrderListResponseSchema)
assert.equal(workOrderApiContract.response.detail, workOrderDetailResponseSchema)
assert.equal(workOrderApiContract.response.create, workOrderCreateResponseSchema)
assert.equal('update' in workOrderApiContract.response, false)

assert.deepEqual(Object.keys(workOrderListResponseSchema.shape), LIST_RESPONSE_FIELDS)
assert.equal(Object.hasOwn(workOrderListResponseSchema.shape, 'items'), false)
assert.deepEqual(Object.keys(workOrderDetailResponseSchema.shape), DETAIL_RESPONSE_FIELDS)
assert.deepEqual(Object.keys(workOrderCreateResponseSchema.shape), CREATE_RESPONSE_FIELDS)

assert.deepEqual(workOrderListQuerySchema.parse({}), {
  keyword: '',
  page: API_PAGINATION_DEFAULTS.page,
  perPage: 500,
  sortBy: 'receivedDate',
  sortOrder: 'desc',
})
assert.deepEqual(workOrderListQuerySchema.parse({ customerId: '  CUS-1  ', status: '  DONE  ' }), {
  keyword: '',
  customerId: 'CUS-1',
  status: 'DONE',
  page: API_PAGINATION_DEFAULTS.page,
  perPage: 500,
  sortBy: 'receivedDate',
  sortOrder: 'desc',
})
assert.equal(workOrderListQuerySchema.parse({ perPage: 500 }).perPage, 500)
for (const input of [
  { customerId: '   ' },
  { status: '   ' },
  { page: 0 },
  { page: -1 },
  { page: 1.5 },
  { perPage: 0 },
  { perPage: 501 },
  { perPage: 1.5 },
  { sortBy: 'dueDate' },
  { sortOrder: 'sideways' },
]) {
  assert.throws(() => workOrderListQuerySchema.parse(input), JSON.stringify(input))
}

const minimalCreate = workOrderCreateSchema.parse({
  customerId: '  CUS-1  ',
  receivedDate: ' 2026-08-30 ',
  dueDate: ' 2026-09-01 ',
  serviceType: 'DRCL',
  createdBy: ' staff-1 ',
})
assert.deepEqual(minimalCreate, {
  customerId: 'CUS-1',
  receivedDate: '2026-08-30',
  dueDate: '2026-09-01',
  serviceType: 'DRCL',
  quantity: null,
  hangers: null,
  bags: null,
  note: null,
  orderName: null,
  orderDescription: null,
  createdBy: 'staff-1',
  items: [],
})
assert.equal(workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'WASH', createdBy: 'staff-1',
}).serviceType, 'WASH')
assert.equal(workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1', hangers: 0,
}).hangers, 0)
for (const input of [
  { customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'XXXX', createdBy: 'staff-1' },
  { customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1', hangers: 1.5 },
  { customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1', quantity: -1 },
]) {
  assert.throws(() => workOrderCreateSchema.parse(input), JSON.stringify(input))
}

const statusIsStripped = workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1', status: 'DONE',
})
assert.equal(Object.hasOwn(statusIsStripped, 'status'), false)

const parsedItem = workOrderCreateItemSchema.parse({
  orderId: 'ORD-ignored', createdBy: 'staff-ignored', serviceType: 'WASH', quantity: 1,
})
assert.deepEqual(parsedItem, {
  itemId: null,
  description: null,
  quantity: 1,
  price: null,
  category: null,
  specialInstructions: null,
})
for (const field of ['orderId', 'createdBy', 'serviceType']) {
  assert.equal(Object.hasOwn(parsedItem, field), false, field)
}
assert.equal(workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1',
  items: [{ orderId: 'ORD-ignored', createdBy: 'staff-ignored', serviceType: 'WASH', quantity: 1 }],
}).items.length, 1)
assert.throws(() => workOrderCreateItemSchema.parse({ quantity: 0 }))

const listResponse = {
  orderId: 'ORD-1', customerId: 'CUS-1', customerName: '', orderNumber: null, invoiceNumber: null,
  receivedDate: null, dueDate: null, serviceType: 'legacy-service', status: 'legacy-status', quantity: null,
  hangers: null, bags: null, note: null, createdAt: null,
}
assert.deepEqual(workOrderListResponseSchema.parse(listResponse), listResponse)
assert.throws(() => workOrderListResponseSchema.parse({ ...listResponse, customerName: null }))
assert.deepEqual(workOrderDetailResponseSchema.parse({
  ...listResponse,
  orderName: null,
  orderDescription: null,
  formImage: null,
  hangersImage: null,
  bagsImage: null,
  createdBy: null,
  items: [],
}), {
  ...listResponse,
  orderName: null,
  orderDescription: null,
  formImage: null,
  hangersImage: null,
  bagsImage: null,
  createdBy: null,
  items: [],
})

const createResponse = {
  orderId: 'ORD-1', orderNumber: null, customerId: 'CUS-1', receivedDate: null, dueDate: null,
  serviceType: null, status: null, quantity: null, note: null, createdAt: null, createdBy: null,
  itemsRequested: 0, itemsCreated: 0, itemsFailed: false, itemsError: null,
}
assert.deepEqual(workOrderCreateResponseSchema.parse(createResponse), createResponse)
assert.throws(() => workOrderUpdateSchema.parse({}))

const schemaSource = readFileSync(new URL('../../../../../contracts/work-orders/work-order-api.schema.ts', import.meta.url), 'utf8')
assert.equal(/\bexport\s+type\s+\w+\s*=\s*z\.infer\s*</.test(schemaSource), false)
assert.equal(/\b[a-z][a-z0-9]*_[a-z0-9_]*\b/.test(schemaSource), false)
assert.equal(/\bas\s*\{/.test(schemaSource), false)

console.log('work-order-api.schema.dry-test: OK')
