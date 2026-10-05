import assert from 'node:assert/strict'
import type { OrderSnapshotDto } from '@/data/order-snapshots/order-snapshot.service'
import { filterOrderList } from '@/features/orders/utils/order-list-filter'

const row = (orderId: string, overrides: Partial<OrderSnapshotDto> = {}): OrderSnapshotDto => ({
  orderId, customerId: 'cus-1', orderNumber: null, invoiceNumber: null,
  receivedDate: '2026-10-05', dueDate: '2026-10-07', createdAt: '2026-10-04 23:59:00',
  serviceType: 'WSIR', status: 'PENDING', quantity: 3, note: null, ...overrides,
})
const orders = [
  row('z', { orderNumber: 'ORDER-123' }),
  row('a', { customerId: 'cus-2', receivedDate: '2026-10-04', dueDate: '2026-10-05', createdAt: '2026-10-05 08:00:00', invoiceNumber: 'INV-456' }),
  row('unknown', { customerId: 'missing', receivedDate: null, dueDate: null, createdAt: null, orderNumber: 'ORDER-789', note: 'Alice' }),
]
const customers = new Map([
  ['cus-1', { customerIndex: 'ABC', customerName: 'Alice Smith', phone: '0812345678', address: 'Bangkok Riverside' }],
  ['cus-2', { customerIndex: 'DEF', customerName: 'Bob', phone: '0899999999', address: 'Chiang Mai' }],
])
const ids = (keyword: string, dateField: 'receivedDate' | 'dueDate' | 'createdAt' = 'receivedDate', date = '2026-10-05') =>
  filterOrderList(orders, { keyword, dateField, date }, customers).map((order) => order.orderId)
assert.deepEqual(ids(''), ['z'])
assert.deepEqual(ids('  ', 'dueDate'), ['a'])
assert.deepEqual(ids('', 'createdAt'), ['a'])
assert.deepEqual(ids('', 'createdAt', '2026-10-04'), ['z'])
for (const keyword of [' abc ', 'ALICE', '12345678', 'riverside']) {
  assert.deepEqual(ids(keyword, 'receivedDate', '1900-01-01'), ['z'], 'customer search ignores date')
}
assert.deepEqual(ids(' order-123 '), ['z'])
assert.deepEqual(ids('inv-456'), ['a'], 'invoice search ignores date')
assert.deepEqual(ids('order-789'), ['unknown'], 'unknown customers can still match order fields')
assert.deepEqual(ids('order-'), ['z', 'unknown'], 'matching keeps input order')
assert.deepEqual(ids('Alice'), ['z'], 'unknown customers cannot match customer fields or note')
assert.deepEqual(filterOrderList([orders[2]!], { keyword: 'ABC', dateField: 'receivedDate', date: '2026-10-05' }, customers), [])
assert.deepEqual(ids('missing'), [], 'customer IDs are not search fields')
assert.equal(orders.length, 3, 'filtering does not mutate the snapshot')
console.log('order-list filter dry test passed')
