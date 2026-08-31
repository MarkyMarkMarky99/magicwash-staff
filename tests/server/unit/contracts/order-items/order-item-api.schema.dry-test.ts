import assert from 'node:assert/strict'
import * as orderItemModule from '../../../../../contracts/order-items/order-item-api.schema.js'
import { API_PAGINATION_DEFAULTS } from '../../../../../contracts/shared/api.schema.js'

const {
  MAX_ORDER_ITEMS_PER_PAGE,
  orderItemApiContract,
  orderItemCreateResponseSchema,
  orderItemCreateSchema,
  orderItemDetailResponseSchema,
  orderItemListQuerySchema,
  orderItemResponseSchema,
  orderItemUpdateSchema,
  orderServiceTypeSchema,
} = orderItemModule

const RESPONSE_FIELDS = [
  'orderItemId', 'orderId', 'itemId', 'description', 'quantity', 'price',
  'creditsUsed', 'serviceType', 'specialInstructions', 'createdAt', 'createdBy',
] as const

assert.deepEqual(orderServiceTypeSchema.options, ['WSIR', 'IRON', 'DRCL', 'WASH'])
assert.equal(MAX_ORDER_ITEMS_PER_PAGE, 500)
assert.deepEqual(new Set(Object.keys(orderItemModule)), new Set([
  'MAX_ORDER_ITEMS_PER_PAGE',
  'orderItemApiContract',
  'orderItemCreateResponseSchema',
  'orderItemCreateSchema',
  'orderItemDetailResponseSchema',
  'orderItemListQuerySchema',
  'orderItemResponseSchema',
  'orderItemUpdateSchema',
  'orderServiceTypeSchema',
]))

assert.deepEqual(Object.keys(orderItemApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(orderItemApiContract.query), ['list'])
assert.deepEqual(Object.keys(orderItemApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(orderItemApiContract.response), ['list', 'detail', 'create'])
assert.equal(orderItemApiContract.query.list, orderItemListQuerySchema)
assert.equal(orderItemApiContract.request?.create, orderItemCreateSchema)
assert.equal(orderItemApiContract.request?.update, orderItemUpdateSchema)
assert.equal(orderItemApiContract.response.list, orderItemResponseSchema)
assert.equal(orderItemApiContract.response.detail, orderItemDetailResponseSchema)
assert.equal(orderItemApiContract.response.create, orderItemCreateResponseSchema)
assert.equal('update' in orderItemApiContract.response, false)

assert.throws(() => orderItemListQuerySchema.parse({}))
assert.deepEqual(orderItemListQuerySchema.parse({ orderId: '  ORD-1  ' }), {
  keyword: '', orderId: 'ORD-1', page: API_PAGINATION_DEFAULTS.page, perPage: 500, sortBy: 'createdAt', sortOrder: 'asc',
})
assert.equal(orderItemListQuerySchema.parse({ orderId: 'ORD-1', page: '2', perPage: '500' }).page, 2)
assert.equal(orderItemListQuerySchema.parse({ orderId: 'ORD-1', perPage: 500 }).perPage, 500)
for (const input of [
  { orderId: 'ORD-1', page: 0 },
  { orderId: 'ORD-1', page: -1 },
  { orderId: 'ORD-1', page: 1.5 },
  { orderId: 'ORD-1', perPage: 0 },
  { orderId: 'ORD-1', perPage: 501 },
  { orderId: 'ORD-1', perPage: 1.5 },
  { orderId: 'ORD-1', sortBy: 'description' },
  { orderId: 'ORD-1', sortOrder: 'sideways' },
  { orderId: '   ' },
]) {
  assert.throws(() => orderItemListQuerySchema.parse(input), JSON.stringify(input))
}

assert.deepEqual(
  orderItemCreateSchema.parse({
    orderId: '  ORD-1  ', quantity: 2, createdBy: '  staff-1  ', serviceType: 'WSIR',
  }),
  {
    orderId: 'ORD-1', itemId: null, description: null, quantity: 2, price: null,
    specialInstructions: null, createdBy: 'staff-1',
  },
)
assert.equal(
  Object.hasOwn(orderItemCreateSchema.parse({ orderId: 'ORD-1', quantity: 1, createdBy: 'staff-1', serviceType: 'WSIR' }), 'serviceType'),
  false,
)
for (const input of [
  { orderId: '   ', quantity: 1, createdBy: 'staff-1' },
  { orderId: 'ORD-1', quantity: 0, createdBy: 'staff-1' },
  { orderId: 'ORD-1', quantity: -1, createdBy: 'staff-1' },
]) {
  assert.throws(() => orderItemCreateSchema.parse(input), JSON.stringify(input))
}

const dto = {
  orderItemId: 'ITEM-1', orderId: null, itemId: null, description: 'ผ้าห่ม legacy', quantity: null,
  price: 0, creditsUsed: null, serviceType: 'legacy-service',
  specialInstructions: null, createdAt: null, createdBy: 'staff-1',
}
assert.deepEqual(orderItemResponseSchema.parse(dto), dto)
assert.deepEqual(Object.keys(orderItemResponseSchema.parse(dto)), RESPONSE_FIELDS)
assert.equal(orderItemDetailResponseSchema, orderItemResponseSchema)
assert.equal(orderItemCreateResponseSchema, orderItemResponseSchema)
assert.throws(() => orderItemUpdateSchema.parse({}))

console.log('order-item-api.schema.dry-test: OK')
