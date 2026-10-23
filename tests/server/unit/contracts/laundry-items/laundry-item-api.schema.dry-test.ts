import assert from 'node:assert/strict'
import {
  laundryItemApiContract,
  laundryItemCreateSchema,
  laundryItemUpdateSchema,
} from '../../../../../contracts/laundry-items/laundry-item-api.schema.js'
import { laundryItemsDbContract } from '../../../../../server/sheets/LaundryItems/LaundryItems.db-contract.js'

const create = { id: 'aB01zZ89', customerId: 'customer-1', createdBy: 'staff-1' }
assert.deepEqual(laundryItemCreateSchema.parse(create), create)
for (const imageUrl of ['https://example.test/cover.jpg', '', null]) {
  assert.equal(laundryItemCreateSchema.parse({ ...create, imageUrl }).imageUrl, imageUrl)
  assert.equal(laundryItemApiContract.response.list.shape.imageUrl.safeParse(imageUrl).success, true)
}
assert.equal(laundryItemCreateSchema.safeParse({ ...create, imageUrl: 123 }).success, false)
assert.equal(laundryItemUpdateSchema.safeParse({ imageUrl: 123, updatedBy: 'staff-2' }).success, false)
assert.equal(laundryItemUpdateSchema.safeParse({ imageUrl: undefined, updatedBy: 'staff-2' }).success, false)
for (const id of ['', 'short', '123456789', 'abcd_123', ' abcd1234']) {
  assert.equal(laundryItemCreateSchema.safeParse({ ...create, id }).success, false)
}
for (const field of ['customerId', 'createdBy']) {
  assert.equal(laundryItemCreateSchema.safeParse({ ...create, [field]: '' }).success, false)
  assert.equal(laundryItemCreateSchema.safeParse({ ...create, [field]: undefined }).success, false)
}
for (const field of ['createdAt', 'updatedAt', 'deletedAt', 'unknown']) {
  assert.equal(laundryItemCreateSchema.safeParse({ ...create, [field]: 'forbidden' }).success, false)
}
for (const field of ['itemId', 'washProgram', 'notes', 'imageUrl']) {
  for (const value of ['value', '', null]) {
    assert.equal(laundryItemUpdateSchema.safeParse({ [field]: value, updatedBy: 'staff-2' }).success, true)
  }
  assert.equal(laundryItemUpdateSchema.safeParse({ [field]: 'value' }).success, false)
}
assert.equal(laundryItemUpdateSchema.safeParse({ updatedBy: 'staff-2' }).success, false)
assert.equal(laundryItemUpdateSchema.safeParse({ notes: undefined, updatedBy: 'staff-2' }).success, false)
assert.equal(laundryItemUpdateSchema.safeParse({ notes: 'value', updatedBy: ' ' }).success, false)
for (const field of ['id', 'customerId', 'createdAt', 'createdBy', 'created_at', 'updatedAt', 'deletedAt', 'deletedBy']) {
  assert.equal(laundryItemUpdateSchema.safeParse({ notes: 'value', updatedBy: 'staff-2', [field]: 'forbidden' }).success, false)
}
assert.equal(laundryItemApiContract.query.list.parse({}).keyword, '')
assert.equal(laundryItemApiContract.query.list.parse({ customerId: ' customer-1 ' }).customerId, 'customer-1')
const dbRow = {
  id: create.id, customer_id: create.customerId, item_id: null, wash_program: null, notes: null,
  created_at: '2026-10-23 10:00:00', created_by: create.createdBy, updated_at: null,
  updated_by: null, deleted_at: null, deleted_by: null, image_url: null,
}
assert.equal(laundryItemsDbContract.row.safeParse(dbRow).success, true)
assert.equal(laundryItemsDbContract.row.safeParse({ ...dbRow, image_url: 'https://example.test/cover.jpg' }).success, true)
assert.equal(laundryItemsDbContract.row.safeParse({ ...dbRow, image_url: 123 }).success, false)
assert.equal(laundryItemsDbContract.row.safeParse({ ...dbRow, extra: 'column' }).success, false)
assert.deepEqual(laundryItemsDbContract.writes, { append: true, update: true, delete: false })
assert.equal('valueInput' in laundryItemsDbContract, false)

console.log('laundry-items contract dry tests passed')
