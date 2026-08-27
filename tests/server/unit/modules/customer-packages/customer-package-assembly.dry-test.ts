import assert from 'node:assert/strict'

import {
  CUSTOMER_PACKAGE_SEARCH_FIELDS,
  assembleCustomerPackageRow,
  assembleCustomerPackageRows,
  buildLedger,
  compareRows,
  groupTransactionsByPackage,
  matchesKeyword,
  resolveStatus,
} from '../../../../../server/modules/customer-packages/customer-package-assembly.js'
import { customerPackagePortalRowSchema } from '../../../../../contracts/customer-packages/customer-package-api.schema.js'

type Row = Record<string, unknown>

const ledger = buildLedger([
  { id: 'usage', credit_change: -3, created_at: 'Date(2026,7,1,9,30,0)', type: 'USAGE' },
  { id: 'purchase', credit_change: '10', created_at: '2026-08-01 09:30:00', type: 'PURCHASE' },
] as never)

assert.deepEqual(CUSTOMER_PACKAGE_SEARCH_FIELDS, ['customerPackageId', 'customerId', 'customerName', 'packageCode'])

assert.equal(resolveStatus({ deletedAt: ' ', startDate: '2026-01-01', expiryDate: '2026-01-02', today: '2026-01-03' }), 'CANCELLED')
assert.equal(resolveStatus({ deletedAt: null, startDate: '2026-01-02', expiryDate: null, today: '2026-01-01' }), 'INACTIVE')
assert.equal(resolveStatus({ deletedAt: null, startDate: null, expiryDate: '2026-01-02', today: '2026-01-03' }), 'EXPIRED')
assert.equal(resolveStatus({ deletedAt: null, startDate: '2026-01-01', expiryDate: '2026-01-01', today: '2026-01-01' }), 'ACTIVE')
assert.equal(resolveStatus({ deletedAt: null, startDate: null, expiryDate: null, today: '2026-01-01' }), 'ACTIVE')

assert.deepEqual(ledger, {
  entries: [
    { id: 'purchase', type: 'PURCHASE', creditChange: 10, remainingCredit: 10, referenceSource: null, referenceId: null, notes: null, createdAt: '2026-08-01 09:30:00' },
    { id: 'usage', type: 'USAGE', creditChange: -3, remainingCredit: 7, referenceSource: null, referenceId: null, notes: null, createdAt: '2026-08-01 09:30:00' },
  ],
  remainingCredit: 7,
  usedCredit: 3,
  totalCredit: 10,
})
assert.ok(ledger.entries.every((entry) => !entry.createdAt.includes('T') && !entry.createdAt.includes('+07:00')))
assert.deepEqual(buildLedger([] as never), { entries: [], remainingCredit: 0, usedCredit: 0, totalCredit: 0 })
assert.deepEqual(
  buildLedger([
    { id: 'b', credit_change: -12, created_at: '2026-08-01 00:00:00', type: 'USAGE' },
    { id: 'a', credit_change: 10, created_at: '2026-08-01 00:00:00', type: 'PURCHASE' },
  ] as never),
  {
    entries: [
      { id: 'a', type: 'PURCHASE', creditChange: 10, remainingCredit: 10, referenceSource: null, referenceId: null, notes: null, createdAt: '2026-08-01 00:00:00' },
      { id: 'b', type: 'USAGE', creditChange: -12, remainingCredit: -2, referenceSource: null, referenceId: null, notes: null, createdAt: '2026-08-01 00:00:00' },
    ],
    remainingCredit: -2,
    usedCredit: 12,
    totalCredit: 10,
  },
)

const grouped = groupTransactionsByPackage([
  { id: 'kept', customer_package_id: ' package-1 ' },
  { id: 'dropped', customer_package_id: '' },
] as never)
assert.deepEqual([...grouped.keys()], [' package-1 '])
assert.equal(grouped.get(' package-1 ')?.[0]?.id, 'kept')

const assembled = assembleCustomerPackageRow({
  pkg: {
    id: 'package-1', customer_id: 'customer-1', package_code: 'GOLD', start_date: '  Date(2026,7,1)  ',
    expiry_date: '  2026-08-31  ', deleted_at: null, notes: '  padded  ', service_day: '', time_slot: '', invoice_id: '',
  },
  ledger,
  catalogRow: { package_code: 'GOLD', name: 'Historical Gold', eligible_service: 'wash', deleted_at: '2026-01-01' },
  customerRow: { CustomerID: 'customer-1', CustomerName: '  Padded Customer  ', Phone: ' ', Address: '' },
  today: '2026-08-01',
} as never)

assert.deepEqual(Object.keys(assembled), Object.keys(customerPackagePortalRowSchema.shape))
assert.equal(assembled.startDate, '2026-08-01')
assert.equal(assembled.expiryDate, '2026-08-31')
assert.equal(assembled.customerName, '  Padded Customer  ')
assert.equal(assembled.customerPhone, ' ')
assert.equal(assembled.customerAddress, null)
assert.equal(assembled.packageName, 'Historical Gold')
assert.equal(assembled.notes, '  padded  ')
assert.equal(assembled.status, 'ACTIVE')

const orphan = assembleCustomerPackageRow({
  pkg: { id: 'orphan', customer_id: 'missing', package_code: 'MISSING', deleted_at: '   ' },
  ledger: buildLedger([] as never), catalogRow: undefined, customerRow: undefined, today: '2026-08-01',
} as never)
assert.deepEqual(
  { customerName: orphan.customerName, customerPhone: orphan.customerPhone, customerAddress: orphan.customerAddress, packageName: orphan.packageName, packageEligibleService: orphan.packageEligibleService, status: orphan.status },
  { customerName: '', customerPhone: null, customerAddress: null, packageName: '', packageEligibleService: '', status: 'CANCELLED' },
)

const rows = assembleCustomerPackageRows({
  packages: [{ id: 'package-1', customer_id: 'customer-1', package_code: 'GOLD' }],
  transactions: [{ id: 't1', customer_package_id: 'package-1', credit_change: ' 5 ', created_at: '  2026-08-01 00:00:00  ', type: 'PURCHASE' }],
  catalog: [{ package_code: 'GOLD', name: 'First Gold' }, { package_code: 'GOLD', name: 'Second Gold' }],
  customers: [{ CustomerID: 'customer-1', CustomerName: 'First Customer' }, { CustomerID: 'customer-1', CustomerName: 'Second Customer' }],
  today: '2026-08-01',
} as never)
assert.equal(rows[0]?.packageName, 'First Gold')
assert.equal(rows[0]?.customerName, 'First Customer')
assert.equal(rows[0]?.remainingCredit, 5)

const searchable = { ...assembled, customerName: 'Anne', packageCode: ' GOLD ' } as Row
assert.equal(matchesKeyword(searchable as never, ''), true)
assert.equal(matchesKeyword(searchable as never, "An'ne"), true)
assert.equal(matchesKeyword(searchable as never, 'anne'), false)
assert.equal(matchesKeyword(searchable as never, 'GOLD'), true)
assert.equal(matchesKeyword(searchable as never, ' GOLD '), true)

const blank = { ...assembled, startDate: null, remainingCredit: 0 } as Row
const dated = { ...assembled, startDate: '2026-08-01', remainingCredit: 10 } as Row
assert.ok(compareRows(blank as never, dated as never, 'startDate', 'asc') < 0)
assert.ok(compareRows(blank as never, dated as never, 'startDate', 'desc') > 0)
assert.ok(compareRows(dated as never, blank as never, 'remainingCredit', 'asc') > 0)
assert.ok(compareRows({ ...dated, customerPackageId: '10' } as never, { ...dated, customerPackageId: '2' } as never, 'customerPackageId', 'asc') < 0)

console.log('customer package assembly dry test passed')
