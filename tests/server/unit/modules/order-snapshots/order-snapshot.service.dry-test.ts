import assert from 'node:assert/strict'
import { orderSnapshotRowSchema } from '../../../../../contracts/order-snapshots/order-snapshot-api.schema.js'
import { createOrderSnapshotRoutes } from '../../../../../server/modules/order-snapshots/order-snapshot.module.js'
import { OrderSnapshotService, type OrderSnapshotReader } from '../../../../../server/modules/order-snapshots/order-snapshot.service.js'

let reads = 0
const queries: unknown[] = []
const reader: OrderSnapshotReader = {
  async read(query) {
    reads += 1
    queries.push(query)
    return [
      { id: 'z', customer_id: ' cus-1 ', received_date: 'Date(2026,9,5)', due_date: 'Date(2026,9,7)', timestamp: 'Date(2026,9,5,23,59,0)', order_number: 'ORDER-1', invoice_id: 'INV-1', quantity: 3, note: 'note', order_name: 'excluded' },
      { id: 'b', customer_id: null, received_date: '', due_date: null, timestamp: ' ' },
      { id: 'a', received_date: '2026-10-05 12:00:00', due_date: '', timestamp: null },
      { id: 'old', received_date: '2026-10-04' },
      { id: 'new', received_date: '2026-10-06' },
      { id: 'a-null', received_date: null },
      { id: '', received_date: '2026-10-07' },
      { id: '  ', received_date: '2026-10-07' },
      { received_date: '2026-10-07' },
      { id: 123, received_date: '2026-10-07' },
    ] as never
  },
}
const service = new OrderSnapshotService(() => reader)
const orders = await service.get()
assert.equal(reads, 1, 'each snapshot reads the repository once')
assert.deepEqual(queries, [{
  select: ['id', 'order_number', 'customer_id', 'invoice_id', 'received_date', 'due_date', 'service_type', 'status', 'quantity', 'note', 'timestamp'],
}], 'only the required DB columns are selected, with no where or pagination')
assert.deepEqual(orders.map((order) => order.orderId), ['new', 'a', 'z', 'old', 'a-null', 'b'])
const normalized = orders.find((order) => order.orderId === 'z')!
assert.equal(normalized.customerId, 'cus-1')
assert.equal(normalized.receivedDate, '2026-10-05')
assert.equal(normalized.dueDate, '2026-10-07')
assert.equal(normalized.createdAt, '2026-10-05 23:59:00')
assert.equal(normalized.orderNumber, 'ORDER-1')
assert.equal(normalized.invoiceNumber, 'INV-1')
assert.equal(normalized.quantity, 3)
assert.equal(normalized.note, 'note')
const empty = orders.find((order) => order.orderId === 'b')!
assert.equal(empty.customerId, '')
assert.equal(empty.receivedDate, null)
assert.equal(empty.dueDate, null)
assert.equal(empty.createdAt, null)
for (const order of orders) {
  assert.deepEqual(Object.keys(order), Object.keys(orderSnapshotRowSchema.shape))
  assert.deepEqual(orderSnapshotRowSchema.parse(order), order)
}

const routes = createOrderSnapshotRoutes(service)
assert.ok(routes.collection)
assert.equal(routes.item, undefined)
const result = await routes.collection.handleRequest({
  method: 'GET', query: {}, body: undefined, headers: {}, params: {},
})
assert.equal(result.status, 200)
assert.deepEqual((result.body as { data: unknown }).data, orders)
assert.equal(reads, 2)
const wrongMethod = await routes.collection.handleRequest({
  method: 'POST', query: {}, body: {}, headers: {}, params: {},
})
assert.equal(wrongMethod.status, 405)
assert.equal(wrongMethod.headers?.Allow, 'GET')
const failing = new OrderSnapshotService(() => ({ async read() { throw new Error('sheet unavailable') } }))
await assert.rejects(failing.get(), /sheet unavailable/)
console.log('order-snapshot service dry test passed')
