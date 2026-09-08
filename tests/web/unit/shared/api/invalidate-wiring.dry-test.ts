import assert from 'node:assert/strict'
import { readCache, writeCache } from '@/shared/api/response-cache'
import { createOrderItem } from '@/features/orders/services/order-item.service'

// The cache dry test proves invalidate() clears what it is asked to. This proves the
// other half: that a write service actually calls it, and calls it for every endpoint
// its write affects. Order-item creation is the representative case — it is the only
// write whose stale reads live in two different endpoints, and the cross-endpoint call
// is exactly the kind of line that is easy to drop in a later refactor.

globalThis.fetch = (async () =>
  new Response(JSON.stringify({ success: true, data: {} }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

writeCache('/api/order-items', ['stale'])
writeCache('/api/work-orders?page=1', ['stale'])
writeCache('/api/order-images', ['untouched'])

await createOrderItem({
  orderId: 'order-1',
  itemId: null,
  description: null,
  quantity: 1,
  price: null,
  specialInstructions: null,
  createdBy: 'dry-test',
})

assert.equal(readCache('/api/order-items'), null, 'creating an item clears the item list')
assert.equal(
  readCache('/api/work-orders?page=1'),
  null,
  'and clears work-orders, whose detail embeds the items',
)
assert.ok(readCache('/api/order-images'), 'but leaves an unrelated endpoint cached')

console.log('invalidate-wiring.dry-test: OK')
