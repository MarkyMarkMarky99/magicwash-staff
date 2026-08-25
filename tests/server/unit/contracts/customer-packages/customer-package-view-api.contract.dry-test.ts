import assert from 'node:assert/strict'
import {
  customerPackageDetailResponseSchema,
  customerPackageListQuerySchema,
  customerPackageListResponseSchema,
  customerPackagePortalRowSchema,
  customerPackageSortFieldSchema,
  customerPackageViewApiContract,
  packageCreditMovementTypeSchema,
} from '../../../../../contracts/customer-packages/customer-package-view-api.schema.js'

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

const readOnlyContract = customerPackageViewApiContract as unknown as {
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

console.log('customer-package-view-api.contract.dry-test: OK')
