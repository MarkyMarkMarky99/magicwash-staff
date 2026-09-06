import assert from 'node:assert/strict'
import { ZodNever } from 'zod'

import {
  laundryPhotoApiContract,
  laundryPhotoCreateSchema,
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
  assert.throws(() => laundryPhotoUpdateSchema.parse(input), JSON.stringify(input))
}

assert.equal(laundryPhotoApiContract.request.create, laundryPhotoCreateSchema)
assert.ok(laundryPhotoApiContract.request.create instanceof ZodNever)
assert.equal('create' in laundryPhotoApiContract.response, false)

assert.throws(() => laundryPhotoListQuerySchema.parse({}))
assert.equal(laundryPhotoListQuerySchema.parse({ orderId: 'order-1' }).orderItemId, undefined)
assert.equal(
  laundryPhotoListQuerySchema.parse({ orderId: 'order-1', orderItemId: 'item-2' }).orderItemId,
  'item-2',
)
assert.throws(() => laundryPhotoListQuerySchema.parse({ orderId: '   ' }))

console.log('laundry-photo-api.schema.dry-test: OK')
