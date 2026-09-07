import assert from 'node:assert/strict'
import { ZodError } from 'zod'

import {
  afterPhotoApiContract,
  afterPhotoCreateSchema,
  afterPhotoCreateResponseSchema,
  afterPhotoListQuerySchema,
  afterPhotoUpdateSchema,
} from '../../../../../contracts/after-photos/after-photo-api.schema.js'

assert.deepEqual(afterPhotoUpdateSchema.parse({ orderItemId: 'item-2', updatedBy: 'staff-1' }), {
  orderItemId: 'item-2',
  updatedBy: 'staff-1',
})
assert.deepEqual(afterPhotoUpdateSchema.parse({ orderItemId: ' item-2 ', updatedBy: ' staff-1 ' }), {
  orderItemId: 'item-2',
  updatedBy: 'staff-1',
})

for (const input of [
  { orderItemId: 'item-2', updatedBy: 'staff-1', extra: true },
  { updatedBy: 'staff-1' },
  { orderItemId: '', updatedBy: 'staff-1' },
  { orderItemId: '   ', updatedBy: 'staff-1' },
  { orderItemId: 'item-2' },
  { orderItemId: 'item-2', updatedBy: '' },
  { orderItemId: 'item-2', updatedBy: '   ' },
]) {
  assert.throws(() => afterPhotoUpdateSchema.parse(input), ZodError, JSON.stringify(input))
}

assert.equal(afterPhotoApiContract.request.create, afterPhotoCreateSchema)
assert.deepEqual(afterPhotoCreateSchema.parse({
  orderId: ' order-1 ', imageUrl: ' https://example.test/photo.jpg ', createdBy: ' staff-1 ',
  orderItemId: ' item-1 ', itemId: ' catalog-1 ',
}), {
  orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1',
  orderItemId: 'item-1', itemId: 'catalog-1',
})
assert.deepEqual(afterPhotoCreateSchema.parse({
  orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1',
  orderItemId: null, itemId: null,
}), {
  orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1',
  orderItemId: null, itemId: null,
})
for (const input of [
  {},
  { orderId: '', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1' },
  { orderId: 'order-1', imageUrl: '', createdBy: 'staff-1' },
  { orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: '' },
  { orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1', isActive: true },
]) {
  assert.throws(() => afterPhotoCreateSchema.parse(input), ZodError, JSON.stringify(input))
}
assert.equal(afterPhotoApiContract.response.create, afterPhotoCreateResponseSchema)

assert.throws(() => afterPhotoListQuerySchema.parse({}))
assert.equal(afterPhotoListQuerySchema.parse({ orderId: 'order-1' }).orderItemId, undefined)
assert.equal(
  afterPhotoListQuerySchema.parse({ orderId: 'order-1', orderItemId: 'item-2' }).orderItemId,
  'item-2',
)
assert.throws(() => afterPhotoListQuerySchema.parse({ orderId: '   ' }))

console.log('after-photo-api.schema.dry-test: OK')
