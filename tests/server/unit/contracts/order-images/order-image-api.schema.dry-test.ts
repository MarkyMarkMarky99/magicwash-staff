import assert from 'node:assert/strict'
import { ZodError } from 'zod'
import * as orderImageModule from '../../../../../contracts/order-images/order-image-api.schema.js'
import { API_PAGINATION_DEFAULTS } from '../../../../../contracts/shared/api.schema.js'

const {
  MAX_ORDER_IMAGES_PER_PAGE,
  orderImageApiContract,
  orderImageCreateResponseSchema,
  orderImageCreateSchema,
  orderImageDetailResponseSchema,
  orderImageListQuerySchema,
  orderImageResponseSchema,
  orderImageTypeSchema,
  orderImageUpdateSchema,
} = orderImageModule

const RESPONSE_FIELDS = [
  'orderImageId', 'orderId', 'customerId', 'deliveryId', 'imageType', 'imagePath',
  'notes', 'quantity', 'createdAt', 'createdBy',
] as const

assert.deepEqual(orderImageTypeSchema.options, ['WEIGHT', 'BELONGING', 'DOCUMENT'])
assert.equal(MAX_ORDER_IMAGES_PER_PAGE, 500)
assert.deepEqual(new Set(Object.keys(orderImageModule)), new Set([
  'MAX_ORDER_IMAGES_PER_PAGE',
  'orderImageApiContract',
  'orderImageCreateResponseSchema',
  'orderImageCreateSchema',
  'orderImageDetailResponseSchema',
  'orderImageListQuerySchema',
  'orderImageResponseSchema',
  'orderImageTypeSchema',
  'orderImageUpdateSchema',
]))

assert.deepEqual(Object.keys(orderImageApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(orderImageApiContract.query), ['list'])
assert.deepEqual(Object.keys(orderImageApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(orderImageApiContract.response), ['list', 'detail', 'create'])
assert.equal(orderImageApiContract.query.list, orderImageListQuerySchema)
assert.equal(orderImageApiContract.request?.create, orderImageCreateSchema)
assert.equal(orderImageApiContract.request?.update, orderImageUpdateSchema)
assert.equal(orderImageApiContract.response.list, orderImageResponseSchema)
assert.equal(orderImageApiContract.response.detail, orderImageDetailResponseSchema)
assert.equal(orderImageApiContract.response.create, orderImageCreateResponseSchema)
assert.equal('update' in orderImageApiContract.response, false)

assert.throws(() => orderImageListQuerySchema.parse({}))
assert.deepEqual(orderImageListQuerySchema.parse({ orderId: '  ORD-1  ' }), {
  keyword: '', orderId: 'ORD-1', page: API_PAGINATION_DEFAULTS.page, perPage: 500, sortBy: 'createdAt', sortOrder: 'asc',
})
assert.equal(orderImageListQuerySchema.parse({ orderId: 'ORD-1', page: '2', perPage: '500' }).page, 2)
assert.equal(orderImageListQuerySchema.parse({ orderId: 'ORD-1', perPage: 500 }).perPage, 500)
for (const input of [
  { orderId: 'ORD-1', page: 0 },
  { orderId: 'ORD-1', perPage: 501 },
  { orderId: 'ORD-1', sortBy: 'imageType' },
  { orderId: 'ORD-1', sortOrder: 'sideways' },
  { orderId: '   ' },
]) {
  assert.throws(() => orderImageListQuerySchema.parse(input), JSON.stringify(input))
}

const minimalCreate = { orderId: 'ORD-1', imageType: 'WEIGHT', imagePath: 'https://firebasestorage.example/x.jpg', createdBy: 'staff-1' }
assert.deepEqual(orderImageCreateSchema.parse(minimalCreate), {
  orderId: 'ORD-1', customerId: null, deliveryId: null, imageType: 'WEIGHT',
  imagePath: 'https://firebasestorage.example/x.jpg', notes: null, quantity: null, createdBy: 'staff-1',
})
for (const imageType of ['WEIGHT', 'BELONGING', 'DOCUMENT'] as const) {
  assert.equal(orderImageCreateSchema.parse({ ...minimalCreate, imageType }).imageType, imageType)
}
assert.equal(
  orderImageCreateSchema.parse({ ...minimalCreate, deliveryId: '  DEL-1  ' }).deliveryId,
  'DEL-1',
)
assert.equal(orderImageCreateSchema.parse({ ...minimalCreate, imagePath: 'HTTPS://example.com/x.jpg' }).imagePath, 'HTTPS://example.com/x.jpg')
assert.throws(
  () => orderImageCreateSchema.parse({ ...minimalCreate, imagePath: 'OrderForm_Images/x.jpg' }),
  /imagePath must start with http:\/\/ or https:\/\//,
)
for (const imageType of ['BAG', 'FORM', 'PICKUP', 'HANGERS', 'DELIVERED', 'UNRECOGNIZED'] as const) {
  assert.throws(
    () => orderImageCreateSchema.parse({ ...minimalCreate, imageType }),
    ZodError,
    `create schema must reject imageType ${imageType}`,
  )
}
assert.throws(() => orderImageCreateSchema.parse({ ...minimalCreate, imageType: 'bag' }))
assert.throws(() => orderImageCreateSchema.parse({ ...minimalCreate, quantity: -0.01 }))

const dto = {
  orderImageId: 'IMAGE-1', orderId: 'ORD-1', customerId: null, deliveryId: 'DEL-1', imageType: 'legacy spelling',
  imagePath: 'OrderForm_Images/x.jpg', notes: 'รูปเก่า', quantity: 2.75, createdAt: null, createdBy: null,
}
assert.deepEqual(orderImageResponseSchema.parse(dto), dto)
assert.deepEqual(Object.keys(orderImageResponseSchema.parse(dto)), RESPONSE_FIELDS)
assert.equal(orderImageDetailResponseSchema, orderImageResponseSchema)
assert.equal(orderImageCreateResponseSchema, orderImageResponseSchema)
assert.throws(() => orderImageUpdateSchema.parse({}))
for (const imageType of ['BAG', 'HANGERS', 'DELIVERED', 'UNRECOGNIZED', null] as const) {
  assert.equal(orderImageResponseSchema.parse({ ...dto, imageType }).imageType, imageType)
}

console.log('order-image-api.schema.dry-test: OK')
