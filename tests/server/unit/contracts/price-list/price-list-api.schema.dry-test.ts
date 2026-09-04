import assert from 'node:assert/strict'
import { serviceTypeSchema } from '../../../../../contracts/shared/service-type.schema.js'
import {
  priceListApiContract,
  priceListListQuerySchema,
  priceListListResponseSchema,
  priceListSortFieldSchema,
} from '../../../../../contracts/price-list/price-list-api.schema.js'

const RESPONSE_FIELDS = [
  'id', 'itemCode', 'category', 'subcategory', 'itemType', 'variant', 'displayNameTh',
  'displayNameEn', 'serviceType', 'priceGroup', 'unit', 'price', 'creditEligible',
  'effectiveFrom', 'effectiveTo', 'active',
]
const CREATE_FIELDS = [
  'itemCode', 'category', 'subcategory', 'itemType', 'variant', 'displayNameTh',
  'displayNameEn', 'serviceType', 'priceGroup', 'unit', 'price', 'creditEligible',
  'effectiveFrom', 'effectiveTo', 'active',
]
const QUERY_FIELDS = [
  'keyword', 'itemCode', 'category', 'subcategory', 'itemType', 'serviceType', 'priceGroup',
  'page', 'perPage', 'sortBy', 'sortOrder',
]

const createSchema = priceListApiContract.request?.create
const updateSchema = priceListApiContract.request?.update
assert.ok(createSchema)
assert.ok(updateSchema)
assert.deepEqual(Object.keys(priceListApiContract.response), ['list', 'create', 'update'])
assert.deepEqual(Object.keys(priceListListResponseSchema.shape), RESPONSE_FIELDS)
assert.deepEqual(Object.keys(createSchema.shape), CREATE_FIELDS)
assert.deepEqual(Object.keys(updateSchema.shape), CREATE_FIELDS)
assert.deepEqual(Object.keys(priceListListQuerySchema.shape), QUERY_FIELDS)
assert.deepEqual(priceListSortFieldSchema.options, [
  'itemCode', 'category', 'subcategory', 'itemType', 'displayNameTh', 'serviceType',
  'priceGroup', 'price', 'effectiveFrom',
])

assert.deepEqual(priceListListQuerySchema.parse({}), {
  keyword: '', itemCode: null, category: null, subcategory: null, itemType: null,
  serviceType: null, priceGroup: null, page: 1, perPage: 20, sortBy: 'itemCode', sortOrder: 'asc',
})
assert.deepEqual(serviceTypeSchema.options, ['WSIR', 'IRON', 'DRCL', 'WASH'])

const createPayload = {
  itemCode: 'ITM-0001', category: 'tops', subcategory: 'shirt', itemType: 'shirt',
  variant: null, displayNameTh: 'เสื้อเชิ้ต', displayNameEn: null, serviceType: 'WSIR',
  priceGroup: 'DEFAULT', unit: null, price: 0, creditEligible: false,
  effectiveFrom: '2026-01-02', effectiveTo: null, active: true,
}
assert.deepEqual(createSchema.parse(createPayload), createPayload)
assert.deepEqual(updateSchema.parse({ price: 88, serviceType: 'IRON' }), { price: 88, serviceType: 'IRON' })

for (const invalid of [
  { ...createPayload, itemCode: 'ITEM-0001' },
  { ...createPayload, price: null },
  { ...createPayload, price: '0' },
  { ...createPayload, price: -1 },
  { ...createPayload, serviceType: 'OTHER' },
  { ...createPayload, id: 'a1b2c3d4' },
  { ...createPayload, washDryIronPrice: 0 },
]) {
  assert.throws(() => createSchema.parse(invalid))
}

assert.throws(() => updateSchema.parse({ price: -1 }))
assert.throws(() => updateSchema.parse({ id: 'a1b2c3d4' }))
assert.throws(() => priceListListQuerySchema.parse({ serviceType: 'OTHER' }))

const response = { id: 'a1b2c3d4', ...createPayload }
assert.deepEqual(priceListListResponseSchema.parse(response), response)
assert.throws(() => priceListListResponseSchema.parse({ ...response, price: -1 }))

console.log('price-list-api.schema.dry-test: OK')
