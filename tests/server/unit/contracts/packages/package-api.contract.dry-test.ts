import assert from 'node:assert/strict'
import {
  packageApiContract,
  packageCreateRequestSchema,
  packageListQuerySchema,
  packageResponseSchema,
  packageUpdateRequestSchema,
} from '../../../../../contracts/packages/package-api.schema.js'

assert.deepEqual(Object.keys(packageResponseSchema.shape), [
  'packageCode',
  'name',
  'eligibleService',
  'includedCredit',
  'price',
  'notes',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'deletedAt',
  'deletedBy',
])

assert.deepEqual(Object.keys(packageCreateRequestSchema.shape), [
  'packageCode',
  'name',
  'eligibleService',
  'includedCredit',
  'price',
  'notes',
  'createdBy',
])

const createRequest = packageCreateRequestSchema.parse({
  packageCode: 'WASH_10',
  name: 'Wash ten credits',
  eligibleService: 'wash',
  includedCredit: 10,
  price: 100,
  createdBy: 'staff-1',
})
assert.equal(createRequest.notes, null)

assert.throws(() => packageCreateRequestSchema.parse({
  ...createRequest,
  createdAt: '2026-08-27T10:00:00.000Z',
}))

assert.deepEqual(Object.keys(packageUpdateRequestSchema.shape), [
  'name',
  'eligibleService',
  'includedCredit',
  'price',
  'notes',
  'active',
  'updatedBy',
])

assert.equal(
  packageUpdateRequestSchema.parse({ active: false, updatedBy: 'staff-1' }).active,
  false,
)
assert.equal(
  packageUpdateRequestSchema.parse({ active: true, updatedBy: 'staff-1' }).active,
  true,
)
assert.throws(() => packageUpdateRequestSchema.parse({
  active: false,
  updatedBy: 'staff-1',
  deletedAt: '2026-08-27T10:00:00.000Z',
}))

assert.deepEqual(packageListQuerySchema.parse({}), {
  keyword: '',
  packageCode: null,
  eligibleService: null,
  page: 1,
  perPage: 20,
  sortBy: 'packageCode',
  sortOrder: 'asc',
})

assert.throws(() => packageListQuerySchema.parse({ perPage: 201 }))

assert.equal(packageApiContract.query.list, packageListQuerySchema)
assert.equal(packageApiContract.request?.create, packageCreateRequestSchema)
assert.equal(packageApiContract.request?.update, packageUpdateRequestSchema)
assert.equal(packageApiContract.response.list, packageResponseSchema)
assert.equal(packageApiContract.response.detail, packageResponseSchema)
assert.equal(packageApiContract.response.create, packageResponseSchema)
assert.equal(packageApiContract.response.update, packageResponseSchema)

console.log('package API contract dry test passed')
