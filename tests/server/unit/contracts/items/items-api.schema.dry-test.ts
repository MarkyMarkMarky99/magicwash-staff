import assert from 'node:assert/strict'
import { itemsCreateSchema, itemsListQuerySchema, itemsUpdateSchema } from '../../../../../contracts/items/items-api.schema.js'

const valid = { category: ' shirts ', subcategory: ' formal ', itemType: 'shirt', displayNameTh: 'เสื้อ' }
assert.deepEqual(itemsCreateSchema.parse(valid), {
  category: 'shirts', subcategory: 'formal', itemType: 'shirt', displayNameTh: 'เสื้อ', active: true,
})
for (const override of [{ id: 'abcd1234' }, { itemCode: 'ITM-0099' }, { price: 10 }, { serviceType: 'WASH' }, { priceGroup: 'DEFAULT' }]) {
  assert.equal(itemsCreateSchema.safeParse({ ...valid, ...override }).success, false)
  assert.equal(itemsUpdateSchema.safeParse(override).success, false)
}
assert.equal(itemsCreateSchema.safeParse({ ...valid, displayNameTh: '   ' }).success, false)
assert.equal(itemsCreateSchema.parse({ ...valid, variant: null, displayNameEn: null, imageUrl: null }).variant, null)
assert.deepEqual(itemsUpdateSchema.parse({ displayNameEn: ' Name ' }), { displayNameEn: 'Name' })
assert.equal(itemsListQuerySchema.parse({ active: 'false' }).active, false)
assert.equal(itemsListQuerySchema.parse({ active: 'true' }).active, true)
assert.equal(itemsListQuerySchema.parse({}).active, null)
assert.equal(itemsListQuerySchema.safeParse({ active: 'not-a-boolean' }).success, false)

console.log('items schema dry test passed')
