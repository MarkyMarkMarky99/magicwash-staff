import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { buildItemNames, FALLBACK_ITEM_NAME, itemNameFor } from '@/features/job-tickets/packaging-item-names'
import { loadItemNames } from '@/features/job-tickets/packaging-bag-source'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { invalidate } from '@/shared/api/response-cache'

const items = [
  { orderItemId: 'oi-1', description: 'เสื้อเชิ้ต' },
  { orderItemId: 'oi-2', description: '  กางเกง  ' },
  { orderItemId: 'oi-3', description: null },
  { orderItemId: 'oi-4', description: '   ' },
]
const names = buildItemNames([
  { itemId: 'tag-1', orderItemId: 'oi-1' },
  { itemId: 'tag-1', orderItemId: 'oi-2' },
  { itemId: 'tag-2', orderItemId: 'oi-2' },
  { itemId: 'tag-3', orderItemId: 'oi-3' },
  { itemId: 'tag-4', orderItemId: 'oi-4' },
  { itemId: 'tag-5', orderItemId: 'missing' },
  { itemId: 'CAT-shirt', orderItemId: 'oi-1' },
], items)
assert.equal(names.get('tag-1'), 'เสื้อเชิ้ต')
assert.equal(names.get('tag-2'), 'กางเกง')
for (const tag of ['tag-3', 'tag-4', 'tag-5', 'tag-9']) assert.equal(itemNameFor(names, tag), FALLBACK_ITEM_NAME)
assert.equal(FALLBACK_ITEM_NAME, 'Item')
assert.equal(itemNameFor(names, 'tag-1'), 'เสื้อเชิ้ต')
assert.equal(buildItemNames([], items).size, 0)

setActivePinia(createPinia())
const calls: string[] = []
let failWorkOrder = false
const originalFetch = globalThis.fetch
const photo = (itemId: unknown, orderItemId: string | null) => ({ laundryPhotoId: `p-${calls.length}-${String(itemId)}`, orderId: 'order-1', orderItemId, itemId, imageUrl: 'https://x/y.jpg' })
globalThis.fetch = (async (input) => {
  const url = new URL(String(input), 'http://localhost')
  calls.push(url.pathname)
  if (url.pathname === '/api/laundry-photos') return Response.json({ success: true, data: [photo('tag-1', 'oi-1'), photo(12345, 'oi-2'), photo('CAT-1', 'oi-1'), photo('tag-x', null)], meta: { pagination: { page: 1, perPage: 500 } } })
  if (url.pathname === '/api/work-orders/order-1') {
    if (failWorkOrder) return Response.json({ success: false, error: { code: 'INTERNAL', message: 'boom' }, meta: { timestamp: new Date().toISOString() } }, { status: 500 })
    return Response.json({ success: true, data: { orderId: 'order-1', items }, meta: {} })
  }
  throw new Error(`Unexpected endpoint ${url.pathname}`)
}) as typeof fetch

try {
  invalidate()
  const loaded = await loadItemNames('order-1')
  assert.deepEqual(calls.toSorted(), ['/api/laundry-photos', '/api/work-orders/order-1'])
  assert.equal(loaded.get('tag-1'), 'เสื้อเชิ้ต')
  assert.equal(loaded.get('00012345'), 'กางเกง')
  assert.equal(loaded.has('tag-x'), false)
  // The fetched detail lands in the work-order store, so other pages reuse it.
  assert.equal(useWorkOrderStore().currentOrder?.orderId, 'order-1')

  // A work order already in the store is reused: only the photo rows are requested.
  const store = useWorkOrderStore()
  store.clearDetail()
  invalidate()
  calls.length = 0
  store.currentOrder = { orderId: 'order-1', items: [{ orderItemId: 'oi-1', description: 'จากสโตร์' }] } as typeof store.currentOrder
  assert.equal((await loadItemNames('order-1')).get('tag-1'), 'จากสโตร์')
  assert.deepEqual(calls, ['/api/laundry-photos'])

  // A seeded detail without items is not reusable, and a failed read leaves every garment on the fallback.
  invalidate()
  calls.length = 0
  failWorkOrder = true
  store.currentOrder = { orderId: 'order-1', items: [] } as typeof store.currentOrder
  const failed = await loadItemNames('order-1')
  assert.equal(calls.length, 2)
  assert.equal(failed.size, 0)
  console.log('packaging-item-names.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
