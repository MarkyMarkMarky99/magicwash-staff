import assert from 'node:assert/strict'
import { ZodError } from 'zod'

import {
  laundryPhotoApiContract,
  laundryPhotoCreateSchema,
  laundryPhotoCreateResponseSchema,
  laundryPhotoListQuerySchema,
  laundryPhotoUpdateSchema,
} from '../../../../../contracts/laundry-photos/laundry-photo-api.schema.js'

assert.deepEqual(laundryPhotoUpdateSchema.parse({ orderItemId: 'item-2', updatedBy: 'staff-1' }), {
  orderItemId: 'item-2',
  updatedBy: 'staff-1',
})
assert.deepEqual(laundryPhotoUpdateSchema.parse({ orderItemId: ' item-2 ', updatedBy: ' staff-1 ' }), {
  orderItemId: 'item-2',
  updatedBy: 'staff-1',
})

for (const input of [
  { orderItemId: 'item-2', updatedBy: 'staff-1', extra: true },
  { updatedBy: 'staff-1' },
  { orderItemId: '' , updatedBy: 'staff-1' },
  { orderItemId: '   ', updatedBy: 'staff-1' },
  { orderItemId: 'item-2' },
  { orderItemId: 'item-2', updatedBy: '' },
  { orderItemId: 'item-2', updatedBy: '   ' },
]) {
  assert.throws(() => laundryPhotoUpdateSchema.parse(input), ZodError, JSON.stringify(input))
}

assert.deepEqual(laundryPhotoCreateSchema.parse({
  orderId: ' order-1 ', imageUrl: ' https://example.test/photo.jpg ', createdBy: ' staff-1 ',
  orderItemId: ' item-1 ', itemId: ' catalog-1 ',
}), {
  orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1',
  orderItemId: 'item-1', itemId: 'catalog-1',
})
assert.deepEqual(laundryPhotoCreateSchema.parse({
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
  assert.throws(() => laundryPhotoCreateSchema.parse(input), ZodError, JSON.stringify(input))
}
assert.equal(laundryPhotoApiContract.request.create, laundryPhotoCreateSchema)
assert.equal(laundryPhotoApiContract.response.create, laundryPhotoCreateResponseSchema)

assert.throws(() => laundryPhotoListQuerySchema.parse({}))
assert.equal(laundryPhotoListQuerySchema.parse({ orderId: 'order-1' }).orderItemId, undefined)
assert.equal(
  laundryPhotoListQuerySchema.parse({ orderId: 'order-1', orderItemId: 'item-2' }).orderItemId,
  'item-2',
)
assert.throws(() => laundryPhotoListQuerySchema.parse({ orderId: '   ' }))

console.log('laundry-photo-api.schema.dry-test: OK')
