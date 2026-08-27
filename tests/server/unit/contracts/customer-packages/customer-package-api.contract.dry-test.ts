import assert from 'node:assert/strict'
import {
  appendPackageTransactionRequestSchema,
  appendPackageTransactionResponseSchema,
  customerPackageApiContract,
  customerPackageDetailResponseSchema,
  customerPackageListQuerySchema,
  customerPackageListResponseSchema,
  customerPackagePortalRowSchema,
  customerPackageSortFieldSchema,
  packageCreditMovementTypeSchema,
  packageTransactionSchema,
  packageTransactionTypeSchema,
  createCustomerPackageRequestSchema,
  createCustomerPackageResponseSchema,
} from '../../../../../contracts/customer-packages/customer-package-api.schema.js'

const request = createCustomerPackageRequestSchema.parse({
  customerId: 'customer-1',
  packageCode: 'GOLD',
  createdBy: 'staff-1',
})

assert.deepEqual(request, {
  customerId: 'customer-1',
  packageCode: 'GOLD',
  invoiceId: null,
  startDate: null,
  expiryDate: null,
  serviceDay: null,
  timeSlot: null,
  notes: null,
  createdBy: 'staff-1',
})

for (const field of ['id', 'customerPackageId', 'createdAt', 'openingCredit', 'transactionId']) {
  assert.throws(() =>
    createCustomerPackageRequestSchema.parse({
      customerId: 'customer-1', packageCode: 'GOLD', createdBy: 'staff-1', [field]: 'client-value',
    }),
  )
}

assert.deepEqual(
  createCustomerPackageResponseSchema.options.map((option) => option.shape.kind.value),
  ['created', 'validation_error', 'catalog_read_failed', 'opening_transaction_write_failed', 'package_write_failed'],
)

for (const option of createCustomerPackageResponseSchema.options) {
  for (const forbidden of ['status', 'remainingCredit', 'usedCredit', 'totalCredit']) {
    assert.equal(forbidden in option.shape, false, `${option.shape.kind.value} must not return ${forbidden}`)
  }
}

/** The API-facing fields corresponding to the live CustomerPackageView sheet. */
const SHEET_HEADERS = [
  'customerPackageId',
  'customerId',
  'customerName',
  'customerPhone',
  'customerAddress',
  'packageCode',
  'packageName',
  'packageEligibleService',
  'startDate',
  'expiryDate',
  'status',
  'serviceDay',
  'timeSlot',
  'invoiceId',
  'notes',
  'remainingCredit',
  'usedCredit',
  'totalCredit',
  'transactions',
] as const

const expectedFields = [...SHEET_HEADERS]

assert.deepEqual(
  Object.keys(customerPackagePortalRowSchema.shape),
  SHEET_HEADERS,
  'portal row schema fields must match the sheet projection one-for-one, in order',
)

const defaults = customerPackageListQuerySchema.parse({})
assert.equal(defaults.sortBy, 'startDate')
assert.equal(defaults.sortOrder, 'desc')
assert.equal(defaults.page, 1)
assert.equal(defaults.keyword, '')
assert.equal(defaults.customerId, null)
assert.equal(defaults.status, null)
assert.equal(defaults.packageCode, null)

const RESERVED = new Set(['keyword', 'page', 'perPage', 'sortBy', 'sortOrder'])
for (const field of Object.keys(customerPackageListQuerySchema.shape)) {
  if (RESERVED.has(field)) continue
  assert.ok(
    (expectedFields as readonly string[]).includes(field),
    `list query filter '${field}' does not resolve to a sheet column`,
  )
}

assert.throws(() => customerPackageListQuerySchema.parse({ perPage: 101 }))
assert.equal(customerPackageListQuerySchema.parse({ perPage: 100 }).perPage, 100)

assert.deepEqual(customerPackageSortFieldSchema.options, [
  'customerPackageId',
  'startDate',
  'expiryDate',
  'status',
  'remainingCredit',
])
assert.deepEqual(
  customerPackageListQuerySchema.shape.sortBy.removeDefault().options,
  customerPackageSortFieldSchema.options,
)
for (const field of customerPackageSortFieldSchema.options) {
  assert.ok((expectedFields as readonly string[]).includes(field))
  assert.notEqual(field, 'transactions')
}
assert.ok(!customerPackageSortFieldSchema.options.includes('transactions' as never))
assert.throws(() => customerPackageListQuerySchema.parse({ sortBy: 'transactions' }))

// The list deliberately omits the serialized transaction ledger; detail keeps it.
assert.ok(!('transactions' in customerPackageListResponseSchema.shape))
assert.ok('transactions' in customerPackageDetailResponseSchema.shape)

const readOnlyContract = customerPackageApiContract as unknown as {
  request?: unknown
  response: Record<string, unknown>
}
assert.equal(readOnlyContract.request, undefined)
assert.equal(readOnlyContract.response.create, undefined)
assert.equal(readOnlyContract.response.update, undefined)

const overspentRow = {
  customerPackageId: 'aifjqbax',
  customerId: '9a8056f8',
  customerName: 'Chariyakorn Sontampisan',
  customerPhone: null,
  customerAddress: null,
  packageCode: 'SILVER',
  packageName: 'Wash-and-Iron Silver 40 Credits',
  packageEligibleService: 'wash_iron',
  startDate: '2026-06-08',
  expiryDate: '2026-07-08',
  status: 'EXPIRED',
  serviceDay: null,
  timeSlot: null,
  invoiceId: null,
  notes: null,
  // Overspending is valid and must survive response validation.
  remainingCredit: -22,
  usedCredit: 62,
  totalCredit: 40,
  transactions: [
    {
      id: 'tx1',
      type: 'PURCHASE',
      creditChange: 40,
      remainingCredit: 40,
      referenceSource: 'CustomerPackages',
      referenceId: 'aifjqbax',
      notes: null,
      createdAt: '2026-07-13T18:08:20+07:00',
    },
  ],
}
assert.doesNotThrow(() => customerPackageDetailResponseSchema.parse(overspentRow))

const orphanRow = {
  ...overspentRow,
  customerPackageId: 'tst00007',
  // Unresolved joins degrade to empty strings rather than null.
  customerName: '',
  packageName: '',
  packageEligibleService: '',
  status: 'ACTIVE',
  expiryDate: null,
  remainingCredit: 0,
  usedCredit: 0,
  totalCredit: 0,
  transactions: [],
}
assert.doesNotThrow(() => customerPackageDetailResponseSchema.parse(orphanRow))

// Only create may open a package, so PURCHASE is not a recordable movement.
assert.ok(!packageCreditMovementTypeSchema.options.includes('PURCHASE' as never))

const base = { customerPackageId: 'package-1', createdBy: 'staff-1' }

assert.equal(packageCreditMovementTypeSchema.safeParse('PURCHASE').success, false)
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: 0 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'PURCHASE', creditChange: 1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: 1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'REFUND', creditChange: -1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: -1, customerId: 'client-1' }))

assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: -1 }).creditChange, -1)
assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type: 'REFUND', creditChange: 1 }).creditChange, 1)

for (const type of ['ADJUSTMENT', 'VOID', 'TRANSFER', 'EXPIRE'] as const) {
  for (const creditChange of [-1, 1]) {
    assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type, creditChange }).creditChange, creditChange)
  }
}

assert.deepEqual(
  appendPackageTransactionResponseSchema.options.map((option) => option.shape.kind.value),
  ['created', 'validation_error', 'package_not_found', 'package_lookup_failed', 'transaction_write_failed'],
)

assert.deepEqual(packageTransactionTypeSchema.options, ['PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRE', 'VOID', 'TRANSFER'])
assert.deepEqual(Object.keys(packageTransactionSchema.shape), [
  'id',
  'type',
  'creditChange',
  'remainingCredit',
  'referenceSource',
  'referenceId',
  'notes',
  'createdAt',
])

console.log('customer package API contract dry test passed')
