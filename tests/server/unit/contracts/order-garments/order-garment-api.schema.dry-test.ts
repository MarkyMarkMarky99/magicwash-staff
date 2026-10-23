import assert from 'node:assert/strict'
import { orderGarmentApiContract, orderGarmentCreateSchema, orderGarmentUpdateSchema } from '../../../../../contracts/order-garments/order-garment-api.schema.js'
import { orderGarmentsDbContract } from '../../../../../server/sheets/OrderGarments/OrderGarments.db-contract.js'

const create = {
  orderId: 'order-1', laundryItemId: 'aB01zZ89', status: 'RECEIVED', orderitemId: 'line-1',
  notes: 'silk', createdBy: 'staff-1',
}
assert.deepEqual(orderGarmentCreateSchema.parse(create), create)
for (const field of ['orderId', 'laundryItemId', 'status', 'createdBy']) {
  for (const value of ['', ' ', null, undefined, 123]) {
    assert.equal(orderGarmentCreateSchema.safeParse({ ...create, [field]: value }).success, false)
  }
}
for (const laundryItemId of ['', 'short', '123456789', 'abcd_123', ' abcd1234']) {
  assert.equal(orderGarmentCreateSchema.safeParse({ ...create, laundryItemId }).success, false)
  assert.equal(orderGarmentApiContract.query.list.safeParse({ laundryItemId }).success, false)
}
for (const field of ['id', 'createdAt', 'updatedAt', 'deletedAt', 'unknown']) {
  assert.equal(orderGarmentCreateSchema.safeParse({ ...create, [field]: 'forbidden' }).success, false)
}
for (const field of ['orderitemId', 'notes']) {
  for (const value of ['value', '', null]) {
    assert.equal(orderGarmentCreateSchema.safeParse({ ...create, [field]: value }).success, true)
    assert.equal(orderGarmentUpdateSchema.safeParse({ [field]: value, updatedBy: 'staff-2' }).success, true)
  }
  assert.equal(orderGarmentUpdateSchema.safeParse({ [field]: 'value' }).success, false)
  assert.equal(orderGarmentUpdateSchema.safeParse({ [field]: 123, updatedBy: 'staff-2' }).success, false)
}
for (const value of ['RECEIVED', 'WASHING', 'DRY_CLEANING', 'IRONING', 'PACKING', 'READY', 'DELIVERED']) {
  assert.equal(orderGarmentCreateSchema.safeParse({ ...create, status: value }).success, true)
  assert.equal(orderGarmentUpdateSchema.safeParse({ status: value, updatedBy: 'staff-2' }).success, true)
}
for (const value of ['UNKNOWN', '', null]) {
  assert.equal(orderGarmentCreateSchema.safeParse({ ...create, status: value }).success, false)
  assert.equal(orderGarmentUpdateSchema.safeParse({ status: value, updatedBy: 'staff-2' }).success, false)
}
assert.equal(orderGarmentUpdateSchema.safeParse({ updatedBy: 'staff-2' }).success, false)
assert.equal(orderGarmentUpdateSchema.safeParse({ notes: undefined, updatedBy: 'staff-2' }).success, false)
assert.equal(orderGarmentUpdateSchema.safeParse({ notes: 'value', updatedBy: ' ' }).success, false)
for (const field of ['id', 'laundryItemId', 'createdAt', 'createdBy', 'created_at', 'updatedAt', 'deletedAt', 'deletedBy', 'orderId']) {
  assert.equal(orderGarmentUpdateSchema.safeParse({ notes: 'value', updatedBy: 'staff-2', [field]: 'forbidden' }).success, false)
}
const query = orderGarmentApiContract.query.list.parse({})
assert.equal(query.keyword, '')
assert.deepEqual(query, { keyword: '', page: 1, perPage: 20, sortBy: 'createdAt', sortOrder: 'asc' })
for (const invalid of [{ page: 0 }, { perPage: 1001 }, { sortBy: 'notes' }, { sortOrder: 'invalid' }]) {
  assert.equal(orderGarmentApiContract.query.list.safeParse(invalid).success, false)
}
const dbRow = {
  id: 'row-id-1', order_id: 'order-1', laundry_item_id: 'aB01zZ89', orderitem_id: 'line-1',
  notes: 'silk', status: 'RECEIVED', created_at: '2026-10-23 10:00:00', created_by: 'staff-1',
  updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
}
assert.equal(orderGarmentsDbContract.row.safeParse(dbRow).success, true)
assert.equal(orderGarmentsDbContract.row.safeParse({ ...dbRow, extra: 'column' }).success, false)
assert.equal(orderGarmentsDbContract.row.safeParse({ ...dbRow, laundry_item_id: 'bad' }).success, false)
assert.deepEqual(orderGarmentsDbContract.writes, { append: true, update: true, delete: false })
assert.equal('valueInput' in orderGarmentsDbContract, false)
console.log('order-garments contract dry tests passed')
