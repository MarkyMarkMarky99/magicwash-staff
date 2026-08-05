import assert from 'node:assert/strict'
import {
  customerPackageCreateSchema,
  customerPackageDetailResponseSchema,
  customerPackageListQuerySchema,
  customerPackageListResponseSchema,
  customerPackagePortalRowSchema,
  customerPackageUpdateSchema,
  customerPackageViewApiContract,
  packageCreditMovementTypeSchema,
} from '../../../../../contracts/customer-packages/customer-package-view-api.schema.js'
import { customerPackageViewContract } from '../../../../../server/modules/customer-packages/customer-package-view.contract.js'

/**
 * The physical `CustomerPackageView` headers, in sheet order, per
 * G:\My Drive\Magicwash\Database\GoogleSheets\CustomerPackageView.json
 *
 * GViz binds columns by position, so a schema that omits a column or reorders
 * them reads the wrong values with nothing to catch it. This list is the guard.
 */
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
  'transactionsJson',
] as const

/** The one header whose sheet name differs from its schema key (decodeJsonCells). */
const SHEET_HEADER_TO_FIELD: Record<string, string> = { transactionsJson: 'transactions' }

const expectedFields = SHEET_HEADERS.map((header) => SHEET_HEADER_TO_FIELD[header] ?? header)

// ── Row schema must mirror the sheet exactly, in order ──────────────────────
assert.deepEqual(
  Object.keys(customerPackagePortalRowSchema.shape),
  expectedFields,
  'row schema keys must match the sheet columns one-for-one, in sheet order',
)

// ── Read-only: writing this view must be impossible ─────────────────────────
assert.equal(customerPackageViewContract.db.primaryKey, 'customerPackageId')
assert.deepEqual(customerPackageViewContract.db.fieldMap, {})
assert.equal(customerPackageViewApiContract.response.detail, customerPackageDetailResponseSchema)
assert.ok(
  !('request' in customerPackageViewApiContract),
  'the API contract must expose no write slots',
)
assert.throws(
  () => customerPackageViewContract.db.request.create.parse({}),
  'db create slot must be z.never()',
)
assert.throws(
  () => customerPackageViewContract.db.request.update.parse({}),
  'db update slot must be z.never()',
)

// ── list drops the ledger; detail keeps it ──────────────────────────────────
assert.ok(
  !('transactions' in customerPackageListResponseSchema.shape),
  'list responses must not carry the transaction ledger',
)
assert.ok('transactions' in customerPackageDetailResponseSchema.shape)
assert.equal(
  Object.keys(customerPackageListResponseSchema.shape).length,
  expectedFields.length - 1,
)

// ── sortBy/sortOrder must default: the query builder always emits `order by`
//    and throws when the field is undefined ─────────────────────────────────
const defaults = customerPackageListQuerySchema.parse({})
assert.equal(defaults.sortBy, 'startDate')
assert.equal(defaults.sortOrder, 'desc')
assert.equal(defaults.page, 1)
assert.equal(defaults.keyword, '')
assert.equal(defaults.customerId, null)
assert.equal(defaults.status, null)

// ── every filterable query field must be a real flat column, or the query
//    builder throws on `where` ───────────────────────────────────────────────
const RESERVED = new Set(['keyword', 'page', 'perPage', 'sortBy', 'sortOrder'])
for (const field of Object.keys(customerPackageListQuerySchema.shape)) {
  if (RESERVED.has(field)) {
    continue
  }
  assert.ok(
    expectedFields.includes(field),
    `list query filter '${field}' does not resolve to a sheet column`,
  )
}

// ── sortable fields must be flat columns: GViz cannot sort inside a JSON cell ─
for (const field of customerPackageListQuerySchema.shape.sortBy.removeDefault().options) {
  assert.ok(expectedFields.includes(field), `sortBy '${field}' is not a sheet column`)
  assert.notEqual(field, 'transactions', 'cannot sort by the serialized ledger')
}

// ── perPage is capped ───────────────────────────────────────────────────────
assert.throws(() => customerPackageListQuerySchema.parse({ perPage: 101 }))
assert.equal(customerPackageListQuerySchema.parse({ perPage: 100 }).perPage, 100)

// ── a real row from the sheet, including the states that are easy to get wrong ─
const overspentRow = {
  customerPackageId: 'aifjqbax',
  customerId: '9a8056f8',
  customerName: 'Chariyakorn Sontisampan',
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
  // Overspent: a negative balance is valid and must survive validation.
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
  // Unresolved joins degrade to '' rather than null.
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

// ── write schemas: defined, but deliberately not mounted yet ────────────────
// The moment they land in the contract bundle, createCrudRoutes mounts POST and
// PATCH against a repository that rejects every write.
assert.ok(
  !('create' in customerPackageViewApiContract.response),
  'do not mount create until a write service exists',
)
assert.ok(
  !('update' in customerPackageViewApiContract.response),
  'do not mount update until a write service exists',
)

// create: server owns the id, timestamps and opening credit
const created = customerPackageCreateSchema.parse({ customerId: 'c1', packageCode: 'GOLD' })
assert.deepEqual(created, {
  customerId: 'c1',
  packageCode: 'GOLD',
  invoiceId: null,
  startDate: null,
  expiryDate: null,
  serviceDay: null,
  timeSlot: null,
  notes: null,
})
for (const field of ['id', 'customerPackageId', 'createdAt', 'createdBy', 'remainingCredit']) {
  assert.ok(
    !(field in customerPackageCreateSchema.shape),
    `'${field}' is server-owned and must not be accepted on create`,
  )
}
assert.throws(() => customerPackageCreateSchema.parse({ packageCode: 'GOLD' }))

// update: intent-keyed, never column-keyed
assert.deepEqual(
  customerPackageUpdateSchema.options.map((option) => option.shape.intent.value),
  ['reschedule', 'cancel', 'recordCredit'],
)
assert.throws(() => customerPackageUpdateSchema.parse({ intent: 'nope' }))
assert.equal(customerPackageUpdateSchema.parse({ intent: 'cancel' }).intent, 'cancel')

// only `create` may open a package, so PURCHASE is not a recordable movement
assert.ok(!packageCreditMovementTypeSchema.options.includes('PURCHASE' as never))
assert.throws(() =>
  customerPackageUpdateSchema.parse({ intent: 'recordCredit', type: 'PURCHASE', creditChange: 1 }),
)

// spending past the package is allowed — the overage is billed, not rejected
const overspend = customerPackageUpdateSchema.parse({
  intent: 'recordCredit',
  type: 'USAGE',
  creditChange: -99,
})
assert.equal(overspend.intent, 'recordCredit')
if (overspend.intent === 'recordCredit') {
  assert.equal(overspend.creditChange, -99)
  assert.equal(overspend.referenceSource, null)
}

console.log('customer-package-view.contract.dry-test: OK')
