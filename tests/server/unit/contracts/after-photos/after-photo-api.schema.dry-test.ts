import assert from 'node:assert/strict'
import { ZodNever } from 'zod'

import {
  afterPhotoApiContract,
  afterPhotoCreateSchema,
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
  assert.throws(() => afterPhotoUpdateSchema.parse(input), JSON.stringify(input))
}

assert.equal(afterPhotoApiContract.request.create, afterPhotoCreateSchema)
assert.ok(afterPhotoApiContract.request.create instanceof ZodNever)
assert.equal('create' in afterPhotoApiContract.response, false)

assert.throws(() => afterPhotoListQuerySchema.parse({}))
assert.equal(afterPhotoListQuerySchema.parse({ orderId: 'order-1' }).orderItemId, undefined)
assert.equal(
  afterPhotoListQuerySchema.parse({ orderId: 'order-1', orderItemId: 'item-2' }).orderItemId,
  'item-2',
)
assert.throws(() => afterPhotoListQuerySchema.parse({ orderId: '   ' }))

console.log('after-photo-api.schema.dry-test: OK')
