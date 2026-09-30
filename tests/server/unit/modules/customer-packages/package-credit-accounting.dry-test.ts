import assert from 'node:assert/strict'
import { OrderCreditUsageService } from '../../../../../server/modules/customer-packages/order-credit-usage.service.js'
import { PackageRenewalService } from '../../../../../server/modules/customer-packages/package-renewal.service.js'
import { buildLedger } from '../../../../../server/modules/customer-packages/customer-package-assembly.js'
import { overageAmount } from '../../../../../shared/utils/package-credit.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

const rows = {
  packages: [{ id: 'old', customer_id: 'customer', package_code: 'MONTH', start_date: '2026-09-01', expiry_date: '2026-09-30' },
    { id: 'new', customer_id: 'customer', package_code: 'MONTH', start_date: '2026-10-01', expiry_date: '2026-10-31' }],
  catalog: [{ package_code: 'MONTH', eligible_service: 'WASH' }],
  orders: [{ id: 'order', customer_id: 'customer', service_type: 'WASH', received_date: '2026-09-01', status: 'RECEIVED' },
    { id: 'rated-order', customer_id: 'customer', service_type: 'WASH', received_date: '2026-09-01', status: 'RECEIVED' },
    { id: 'legacy-only', customer_id: 'customer', service_type: 'WASH', received_date: '2026-09-01', status: 'RECEIVED' }],
  orderItems: [{ id: 'rated', order_id: 'order', item_id: 'item', description: 'Shirt', quantity: 2 },
    { id: 'cash', order_id: 'order', item_id: 'AA104', description: 'Legacy suit', quantity: 1 },
    { id: 'rated-only', order_id: 'rated-order', item_id: 'item', description: 'Shirt', quantity: 2 },
    { id: 'legacy-item', order_id: 'legacy-only', item_id: 'AA104', description: 'Legacy shirt', quantity: 4 }],
  items: [{ id: 'item', item_code: 'ITM-0001' }],
  prices: [{ item_code: 'ITM-0001', service_type: 'WASH', price_group: 'CREDIT', active: true,
    effective_from: '2020-01-01', effective_to: null, price: 0.5, unit: 'piece' }],
  transactions: [{ id: 'purchase', customer_package_id: 'old', customer_id: 'customer', type: 'PURCHASE', credit_change: 0.5 }],
}
const reads: Array<{ sheet: string; where: Record<string, unknown> | undefined }> = []
function readRows<T extends Record<string, unknown>>(sheet: string, source: T[], query?: { where?: Record<string, unknown> }): T[] {
  reads.push({ sheet, where: query?.where })
  return source.filter((row) => Object.entries(query?.where ?? {}).every(([key, value]) => row[key] === value))
}
const repositories = {
  packages: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('packages', rows.packages, query) }),
  catalog: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('catalog', rows.catalog, query) }),
  orders: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('orders', rows.orders, query) }),
  orderItems: () => ({ list: async ({ orderId }: { orderId: string }) => ({ items: readRows('orderItems', rows.orderItems, { where: { order_id: orderId } })
    .map((row) => ({ orderItemId: row.id, orderId: row.order_id, itemId: row.item_id, description: row.description, quantity: row.quantity })) }) }),
  items: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('items', rows.items, query) }),
  prices: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('prices', rows.prices, query) }),
  transactions: () => ({ read: async (query?: { where?: Record<string, unknown> }) => readRows('transactions', rows.transactions, query), append: async (row: Record<string, unknown>) => {
    rows.transactions.push(row as never)
    return row
  } }),
} as never

const usage = new OrderCreditUsageService(repositories)
const preview = await usage.preview({ customerPackageId: 'old', orderId: 'order' })
assert.equal(reads.filter((read) => read.sheet === 'catalog').length, 1)
assert.equal(reads.filter((read) => read.sheet === 'items').length, 1)
assert.equal(reads.filter((read) => read.sheet === 'prices').length, 1)
assert.ok(reads.some((read) => read.sheet === 'orderItems' && read.where?.order_id === 'order'))
assert.equal(preview.totalCredits, 1)
assert.equal(preview.items[0]?.creditsPerUnit, 0.5)
assert.equal(preview.items[1]?.credits, null)
assert.match(preview.items[1]?.noRateReason ?? '', /Item not found/i)
const packageReadsBeforeConfirm = reads.filter((read) => read.sheet === 'packages').length
const saved = await usage.confirm({ customerPackageId: 'old', orderId: 'order', createdBy: 'staff', manualCredits: 8 })
assert.equal(reads.filter((read) => read.sheet === 'packages').length - packageReadsBeforeConfirm, 1)
assert.equal(saved.creditChange, -8)
const manualRow = rows.transactions.at(-1) as Record<string, unknown> | undefined
assert.equal(manualRow?.reference_source, 'ORDER')
assert.equal(manualRow?.reference_id, 'order')
assert.equal(manualRow?.notes, 'manual credits')
assert.equal((await usage.preview({ customerPackageId: 'old', orderId: 'order' })).balance, -7.5)
await assert.rejects(() => usage.confirm({ customerPackageId: 'old', orderId: 'order', createdBy: 'staff' }), (error: unknown) => error instanceof ApiError && error.status === 409)
await assert.rejects(() => usage.confirm({ customerPackageId: 'old', orderId: 'order', createdBy: 'staff', manualCredits: 2 }), (error: unknown) => error instanceof ApiError && error.status === 409)
const legacyOnly = await usage.preview({ customerPackageId: 'old', orderId: 'legacy-only' })
assert.equal(legacyOnly.totalCredits, 0)
assert.match(legacyOnly.items[0]?.noRateReason ?? '', /Item not found/i)
assert.equal((await usage.confirm({ customerPackageId: 'old', orderId: 'legacy-only', createdBy: 'staff', manualCredits: 0.5 })).creditChange, -0.5)
assert.equal((rows.transactions.at(-1) as Record<string, unknown> | undefined)?.reference_source, 'ORDER')
await assert.rejects(() => usage.confirm({ customerPackageId: 'old', orderId: 'legacy-only', createdBy: 'staff', manualCredits: 1 }), (error: unknown) => error instanceof ApiError && error.status === 409)
assert.equal((await usage.preview({ customerPackageId: 'old', orderId: 'rated-order' })).items.every((item) => !item.noRateReason), true)
await assert.rejects(() => usage.confirm({ customerPackageId: 'old', orderId: 'rated-order', createdBy: 'staff', manualCredits: 2 }), /Manual credits require/)
assert.equal((await usage.confirm({ customerPackageId: 'old', orderId: 'rated-order', createdBy: 'staff' })).creditChange, -1)
assert.equal((rows.transactions.at(-1) as Record<string, unknown> | undefined)?.reference_source, 'Orders')
rows.catalog[0].eligible_service = 'IRON'
await assert.rejects(() => usage.preview({ customerPackageId: 'old', orderId: 'order' }), (error: unknown) => error instanceof ApiError && /eligible service/.test(error.message))
rows.catalog[0].eligible_service = 'WASH'
for (const receivedDate of ['2026-08-31', '2026-10-01']) {
  rows.orders[0].received_date = receivedDate
  await assert.rejects(() => usage.preview({ customerPackageId: 'old', orderId: 'order' }), /outside this package month/)
}
rows.orders[0].received_date = '2026-09-30'
assert.equal((await usage.preview({ customerPackageId: 'old', orderId: 'order' })).orderId, 'order')
rows.orders[0].received_date = '2026-09-01'
rows.orders[0].status = 'CANCELLED'
await assert.rejects(() => usage.preview({ customerPackageId: 'old', orderId: 'order' }), /Cancelled orders/)
await assert.rejects(() => usage.confirm({ customerPackageId: 'old', orderId: 'order', createdBy: 'staff' }), /Cancelled orders/)
rows.orders[0].status = 'RECEIVED'

assert.equal(overageAmount(0.5), 12.5)
const renewal = new PackageRenewalService(repositories)
await assert.rejects(() => renewal.transfer({ oldPackageId: 'old', newPackageId: 'new', createdBy: 'staff' }), /positive/)
rows.transactions = [{ id: 'purchase', customer_package_id: 'old', customer_id: 'customer', type: 'PURCHASE', credit_change: 2 }] as typeof rows.transactions
const transfer = await renewal.transfer({ oldPackageId: 'old', newPackageId: 'new', createdBy: 'staff' })
assert.equal(transfer.credits, 2)
assert.equal(rows.transactions.filter((row) => row.type === 'TRANSFER').length, 2)
const incoming = rows.transactions.pop()!
assert.equal((await renewal.status('old')).transfers[0]?.pending, true)
await renewal.transfer({ oldPackageId: 'old', newPackageId: 'new', createdBy: 'staff' })
assert.equal(rows.transactions.filter((row) => row.type === 'TRANSFER').length, 2)
assert.equal((await renewal.status('old')).transfers[0]?.pending, false)
assert.equal(incoming.credit_change, 2)
rows.transactions = [{ id: 'purchase', customer_package_id: 'old', customer_id: 'customer', type: 'PURCHASE', credit_change: 2 }, incoming] as typeof rows.transactions
assert.equal((await renewal.status('old')).transfers[0]?.pending, true)
await renewal.transfer({ oldPackageId: 'old', newPackageId: 'new', createdBy: 'staff' })
assert.equal((await renewal.status('old')).transfers[0]?.pending, false)
const display = buildLedger([
  { id: 'p', type: 'PURCHASE', credit_change: 5 }, { id: 'u', type: 'USAGE', credit_change: -1 },
  { id: 't', type: 'TRANSFER', credit_change: -2 }, { id: 'e', type: 'EXPIRE', credit_change: -1 },
] as never)
assert.equal(display.usedCredit, 1)
assert.equal(display.transferredOutCredit, 2)
assert.equal(display.expiredCredit, 1)
assert.equal(display.totalCredit, 5)
assert.ok(reads.filter((read) => !['catalog', 'items', 'prices'].includes(read.sheet))
  .every((read) => read.where && Object.keys(read.where).length > 0), 'large sheet reads must use known equality keys')
assert.ok(reads.filter((read) => ['catalog', 'items', 'prices'].includes(read.sheet)).every((read) => !read.where))
console.log('Package credit usage, overage, and renewal dry test passed')
