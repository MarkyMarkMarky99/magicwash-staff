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
  workOrderStatusSchema,
  workOrderTicketProvisioningSchema,
  workOrderUpdateResponseSchema,
  workOrderUpdateSchema,
} = workOrderModule

const LIST_RESPONSE_FIELDS = [
  'orderId', 'customerId', 'orderNumber', 'invoiceNumber', 'receivedDate',
  'dueDate', 'serviceType', 'status', 'quantity', 'note',
] as const

const DETAIL_RESPONSE_FIELDS = [
  ...LIST_RESPONSE_FIELDS, 'createdAt', 'orderName', 'orderDescription', 'formImage', 'hangersImage',
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
  'workOrderStatusSchema',
  'workOrderTicketProvisioningSchema',
  'workOrderUpdateResponseSchema',
  'workOrderUpdateSchema',
]))

assert.deepEqual(Object.keys(workOrderApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(workOrderApiContract.query), ['list'])
assert.deepEqual(Object.keys(workOrderApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(workOrderApiContract.response), ['list', 'detail', 'create', 'update'])
assert.equal(workOrderApiContract.query.list, workOrderListQuerySchema)
assert.equal(workOrderApiContract.request?.create, workOrderCreateSchema)
assert.equal(workOrderApiContract.request?.update, workOrderUpdateSchema)
assert.equal(workOrderApiContract.response.list, workOrderListResponseSchema)
assert.equal(workOrderApiContract.response.detail, workOrderDetailResponseSchema)
assert.equal(workOrderApiContract.response.create, workOrderCreateResponseSchema)
assert.equal(workOrderApiContract.response.update, workOrderUpdateResponseSchema)
assert.deepEqual(Object.keys(workOrderUpdateResponseSchema.shape), [
  ...LIST_RESPONSE_FIELDS,
  'ticketProvisioning',
])

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
  note: null,
  orderName: null,
  orderDescription: null,
  createdBy: 'staff-1',
  items: [],
})
assert.equal(workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'WASH', createdBy: 'staff-1',
}).serviceType, 'WASH')
const retiredCreateFieldsAreStripped = workOrderCreateSchema.parse({
  customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'DRCL', createdBy: 'staff-1', hangers: 0,
  bags: 0,
})
assert.equal(Object.hasOwn(retiredCreateFieldsAreStripped, 'hangers'), false)
assert.equal(Object.hasOwn(retiredCreateFieldsAreStripped, 'bags'), false)
for (const input of [
  { customerId: 'CUS-1', receivedDate: '2026-08-30', dueDate: '2026-09-01', serviceType: 'XXXX', createdBy: 'staff-1' },
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
  orderId: 'ORD-1', customerId: 'CUS-1', orderNumber: null, invoiceNumber: null,
  receivedDate: null, dueDate: null, serviceType: 'legacy-service', status: 'legacy-status', quantity: null,
  note: null,
}
assert.deepEqual(workOrderListResponseSchema.parse(listResponse), listResponse)
assert.deepEqual(workOrderDetailResponseSchema.parse({
  ...listResponse,
  createdAt: null,
  orderName: null,
  orderDescription: null,
  formImage: null,
  hangersImage: null,
  bagsImage: null,
  createdBy: null,
  items: [],
}), {
  ...listResponse,
  createdAt: null,
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
assert.deepEqual(workOrderStatusSchema.options, [
  'PENDING', 'RECEIVED', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED',
])
assert.deepEqual(workOrderUpdateSchema.parse({ status: 'APPROVED', updatedBy: 'staff-1' }), {
  status: 'APPROVED',
  updatedBy: 'staff-1',
})
assert.deepEqual(workOrderUpdateSchema.parse({
  receivedDate: '2026-09-22', dueDate: '2026-09-25', quantity: null, updatedBy: 'staff-1',
}), {
  receivedDate: '2026-09-22', dueDate: '2026-09-25', quantity: null, updatedBy: 'staff-1',
})
assert.deepEqual(workOrderUpdateSchema.parse({ quantity: 4, updatedBy: 'staff-1' }), {
  quantity: 4, updatedBy: 'staff-1',
})
assert.deepEqual(workOrderTicketProvisioningSchema.parse({
  ticketsCreated: 2,
  skippedGarments: [{
    laundryItemId: 'tag-1', serviceType: null, reason: 'unsupportedServiceType',
  }],
  failure: { certainty: 'unknown' },
}), {
  ticketsCreated: 2,
  skippedGarments: [{
    laundryItemId: 'tag-1', serviceType: null, reason: 'unsupportedServiceType',
  }],
  failure: { certainty: 'unknown' },
})
for (const input of [
  {},
  { status: 'INVALID', updatedBy: 'staff-1' },
  { status: 'APPROVED' },
  { status: 'APPROVED', updatedBy: '' },
  { updatedBy: 'staff-1' },
  { receivedDate: '22/09/2026', updatedBy: 'staff-1' },
  { dueDate: '', updatedBy: 'staff-1' },
  { quantity: -1, updatedBy: 'staff-1' },
]) {
  assert.throws(() => workOrderUpdateSchema.parse(input), JSON.stringify(input))
}

const schemaSource = readFileSync(new URL('../../../../../contracts/work-orders/work-order-api.schema.ts', import.meta.url), 'utf8')
assert.equal(/\bexport\s+type\s+\w+\s*=\s*z\.infer\s*</.test(schemaSource), false)
assert.equal(/\b[a-z][a-z0-9]*_[a-z0-9_]*\b/.test(schemaSource), false)
assert.equal(/\bas\s*\{/.test(schemaSource), false)

console.log('work-order-api.schema.dry-test: OK')
