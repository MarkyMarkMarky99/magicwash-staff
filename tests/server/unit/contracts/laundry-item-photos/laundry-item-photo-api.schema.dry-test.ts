import assert from 'node:assert/strict'
import { laundryItemPhotoApiContract, laundryItemPhotoCreateSchema, laundryItemPhotoUpdateSchema } from '../../../../../contracts/laundry-item-photos/laundry-item-photo-api.schema.js'
import { laundryItemPhotosDbContract } from '../../../../../server/sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'

const create = {
  laundryItemId: 'aB01zZ89', photoType: 'BEFORE', imageUrl: 'https://example.test/photo.jpg',
  orderId: 'order-1', notes: 'silk', createdBy: 'staff-1',
}
assert.deepEqual(laundryItemPhotoCreateSchema.parse(create), create)
for (const field of ['laundryItemId', 'photoType', 'imageUrl', 'createdBy']) {
  for (const value of ['', ' ', null, undefined, 123]) {
    assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, [field]: value }).success, false)
  }
}
for (const laundryItemId of ['', 'short', '123456789', 'abcd_123', ' abcd1234']) {
  assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, laundryItemId }).success, false)
  assert.equal(laundryItemPhotoApiContract.query.list.safeParse({ laundryItemId }).success, false)
}
for (const field of ['id', 'createdAt', 'updatedAt', 'deletedAt', 'unknown']) {
  assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, [field]: 'forbidden' }).success, false)
}
for (const field of ['orderId', 'notes']) {
  for (const value of ['value', '', null]) {
    assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, [field]: value }).success, true)
    assert.equal(laundryItemPhotoUpdateSchema.safeParse({ [field]: value, updatedBy: 'staff-2' }).success, true)
  }
  assert.equal(laundryItemPhotoUpdateSchema.safeParse({ [field]: 'value' }).success, false)
  assert.equal(laundryItemPhotoUpdateSchema.safeParse({ [field]: 123, updatedBy: 'staff-2' }).success, false)
}
for (const value of ['BEFORE', 'AFTER', 'DEFECT']) {
  assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, photoType: value }).success, true)
  assert.equal(laundryItemPhotoUpdateSchema.safeParse({ photoType: value, updatedBy: 'staff-2' }).success, true)
}
for (const value of ['UNKNOWN', '', null]) {
  assert.equal(laundryItemPhotoCreateSchema.safeParse({ ...create, photoType: value }).success, false)
  assert.equal(laundryItemPhotoUpdateSchema.safeParse({ photoType: value, updatedBy: 'staff-2' }).success, false)
}
assert.equal(laundryItemPhotoUpdateSchema.safeParse({ updatedBy: 'staff-2' }).success, false)
assert.equal(laundryItemPhotoUpdateSchema.safeParse({ notes: undefined, updatedBy: 'staff-2' }).success, false)
assert.equal(laundryItemPhotoUpdateSchema.safeParse({ notes: 'value', updatedBy: ' ' }).success, false)
for (const field of ['id', 'laundryItemId', 'createdAt', 'createdBy', 'created_at', 'updatedAt', 'deletedAt', 'deletedBy', 'imageUrl']) {
  assert.equal(laundryItemPhotoUpdateSchema.safeParse({ notes: 'value', updatedBy: 'staff-2', [field]: 'forbidden' }).success, false)
}
const query = laundryItemPhotoApiContract.query.list.parse({})
assert.equal(query.keyword, '')
assert.deepEqual(query, { keyword: '', page: 1, perPage: 20, sortBy: 'createdAt', sortOrder: 'asc' })
for (const invalid of [{ page: 0 }, { perPage: 1001 }, { sortBy: 'notes' }, { sortOrder: 'invalid' }]) {
  assert.equal(laundryItemPhotoApiContract.query.list.safeParse(invalid).success, false)
}
const dbRow = {
  id: 'row-id-1', laundry_item_id: 'aB01zZ89', order_id: 'order-1', photo_type: 'BEFORE',
  image_url: 'https://example.test/photo.jpg', notes: 'silk', created_at: '2026-10-23 10:00:00',
  created_by: 'staff-1', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
}
assert.equal(laundryItemPhotosDbContract.row.safeParse(dbRow).success, true)
assert.equal(laundryItemPhotosDbContract.row.safeParse({ ...dbRow, extra: 'column' }).success, false)
assert.equal(laundryItemPhotosDbContract.row.safeParse({ ...dbRow, laundry_item_id: 'bad' }).success, false)
assert.deepEqual(laundryItemPhotosDbContract.writes, { append: true, update: true, delete: false })
assert.equal('valueInput' in laundryItemPhotosDbContract, false)
console.log('laundry-item-photos contract dry tests passed')
