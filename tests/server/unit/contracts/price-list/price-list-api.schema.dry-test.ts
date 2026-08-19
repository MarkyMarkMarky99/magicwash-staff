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

const BUSINESS_FIELDS = [
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

const REQUIRED_CREATE_FIELDS = [
  'category',
  'subcategory',
  'itemType',
  'displayNameTh',
  'creditEligible',
  'effectiveFrom',
  'active',
] as const

assert.deepEqual(Object.keys(priceListApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(priceListApiContract.query), ['list'])
assert.deepEqual(Object.keys(priceListApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(priceListApiContract.response), ['list', 'create', 'update'])
assert.equal(priceListApiContract.query.list, priceListListQuerySchema)
assert.equal(priceListApiContract.response.list, priceListListResponseSchema)

const createRequestSchema = priceListApiContract.request?.create
const updateRequestSchema = priceListApiContract.request?.update
assert.ok(createRequestSchema)
assert.ok(updateRequestSchema)

const shapeOf = (schema: unknown): Record<string, unknown> => {
  assert.equal(typeof schema, 'object')
  assert.ok(typeof schema === 'object' && schema !== null && 'shape' in schema)
  return (schema as { shape: Record<string, unknown> }).shape
}

assert.deepEqual(Object.keys(shapeOf(createRequestSchema)), BUSINESS_FIELDS)
assert.deepEqual(Object.keys(shapeOf(updateRequestSchema)), BUSINESS_FIELDS)

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
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: false,
}

assert.deepEqual(priceListListResponseSchema.parse(representativeItem), representativeItem)
assert.deepEqual(Object.keys(priceListListResponseSchema.parse(representativeItem)), RESPONSE_FIELDS)
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, id: null }))
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, creditEligible: 'false' }))
assert.throws(() => priceListListResponseSchema.parse({ ...representativeItem, washDryIronPrice: '0' }))
assert.throws(() =>
  priceListListResponseSchema.parse({ ...representativeItem, effectiveFrom: 'Date(2026,0,1)' }),
)

const createPayload = {
  category: 'tops',
  subcategory: 'shirt',
  itemType: 'wash',
  displayNameTh: 'เสื้อเชิ้ต',
  creditEligible: false,
  effectiveFrom: '2026-01-02',
  active: true,
  variant: null,
  washDryIronPrice: 0,
  ironOnlyPrice: null,
  dryCleanPrice: 120,
  effectiveTo: null,
}

assert.deepEqual(createRequestSchema.parse(createPayload), createPayload)
assert.deepEqual(
  createRequestSchema.parse({
    category: 'tops',
    subcategory: 'shirt',
    itemType: 'wash',
    displayNameTh: 'เสื้อเชิ้ต',
    creditEligible: false,
    effectiveFrom: '2026-01-02',
    active: true,
  }),
  {
    category: 'tops',
    subcategory: 'shirt',
    itemType: 'wash',
    displayNameTh: 'เสื้อเชิ้ต',
    creditEligible: false,
    effectiveFrom: '2026-01-02',
    active: true,
  },
)

for (const field of REQUIRED_CREATE_FIELDS) {
  const missingField = { ...createPayload }
  delete (missingField as Record<string, unknown>)[field]
  assert.throws(() => createRequestSchema.parse(missingField), `missing ${field}`)
}

for (const systemField of ['id', 'itemCode']) {
  assert.throws(
    () => createRequestSchema.parse({ ...createPayload, [systemField]: 'client-supplied' }),
    `create rejects ${systemField}`,
  )
}

for (const effectiveFrom of ['2026/01/02', '2026-1-2', 'Date(2026,0,2)']) {
  assert.throws(
    () => createRequestSchema.parse({ ...createPayload, effectiveFrom }),
    `invalid effectiveFrom ${effectiveFrom}`,
  )
}

assert.deepEqual(
  updateRequestSchema.parse({ washDryIronPrice: 88, active: false }),
  { washDryIronPrice: 88, active: false },
)
assert.deepEqual(updateRequestSchema.parse({ effectiveTo: null }), { effectiveTo: null })
for (const systemField of ['id', 'itemCode']) {
  assert.throws(
    () => updateRequestSchema.parse({ active: false, [systemField]: 'changed' }),
    `update rejects ${systemField}`,
  )
}
assert.throws(() => updateRequestSchema.parse({ effectiveFrom: '2026/01/02' }))

console.log('price-list-api.schema.dry-test: OK')
