import assert from 'node:assert/strict'
import {
  priceListApiContract,
  priceListListQuerySchema,
  priceListListResponseSchema,
  priceListSortFieldSchema,
} from '../../../../../contracts/price-list/price-list-api.schema.js'

const RESPONSE_FIELDS = [
  'id',
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'variant',
  'displayNameTh',
  'washDryIronPrice',
  'ironOnlyPrice',
  'dryCleanPrice',
  'creditEligible',
  'effectiveFrom',
  'effectiveTo',
  'active',
] as const

const QUERY_FIELDS = [
  'keyword',
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'page',
  'perPage',
  'sortBy',
  'sortOrder',
] as const

assert.deepEqual(Object.keys(priceListApiContract), ['query', 'response'])
assert.deepEqual(Object.keys(priceListApiContract.query), ['list'])
assert.deepEqual(Object.keys(priceListApiContract.response), ['list'])
assert.equal(priceListApiContract.query.list, priceListListQuerySchema)
assert.equal(priceListApiContract.response.list, priceListListResponseSchema)

assert.deepEqual(Object.keys(priceListListQuerySchema.shape), QUERY_FIELDS)
assert.deepEqual(Object.keys(priceListListResponseSchema.shape), RESPONSE_FIELDS)
assert.deepEqual(priceListSortFieldSchema.options, [
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'displayNameTh',
  'effectiveFrom',
])

const defaults = priceListListQuerySchema.parse({})
assert.deepEqual(defaults, {
  keyword: '',
  itemCode: null,
  category: null,
  subcategory: null,
  itemType: null,
  page: 1,
  perPage: 20,
  sortBy: 'itemCode',
  sortOrder: 'asc',
})

for (const input of [
  { page: 0 },
  { page: -1 },
  { page: 1.5 },
  { perPage: 0 },
  { perPage: 101 },
  { perPage: 2.5 },
  { sortBy: 'active' },
  { sortOrder: 'ascending' },
]) {
  assert.throws(() => priceListListQuerySchema.parse(input), JSON.stringify(input))
}

assert.equal('active' in priceListListQuerySchema.shape, false)
assert.equal('creditEligible' in priceListListQuerySchema.shape, false)

const representativeItem = {
  id: 'price-001',
  itemCode: 'SHIRT-001',
  category: 'tops',
  subcategory: 'shirt',
  itemType: 'itemtype-from-db',
  variant: null,
  displayNameTh: 'เสื้อเชิ้ต',
  washDryIronPrice: 0,
  ironOnlyPrice: null,
  dryCleanPrice: 120,
  creditEligible: false,
  effectiveFrom: 'Date(2026,0,1)',
  effectiveTo: null,
  active: false,
}

assert.deepEqual(priceListListResponseSchema.parse(representativeItem), representativeItem)
assert.deepEqual(Object.keys(priceListListResponseSchema.parse(representativeItem)), RESPONSE_FIELDS)
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, id: null }))
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, creditEligible: 'false' }))
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, washDryIronPrice: '0' }))

console.log('price-list-api.schema.dry-test: OK')
