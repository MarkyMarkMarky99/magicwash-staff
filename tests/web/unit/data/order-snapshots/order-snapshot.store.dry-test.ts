import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useOrderSnapshotStore } from '@/data/order-snapshots/order-snapshot.store'
import { invalidate, readCache, writeCache } from '@/shared/api/response-cache'
import { cachePolicyFor } from '@/shared/config/cache'

const originalFetch = globalThis.fetch
const calls: string[] = []
let respond: ((response: Response) => void) | undefined
let fetched: (() => void) | undefined
let fetchStarted = new Promise<void>((resolve) => { fetched = resolve })
globalThis.fetch = (async (input: string | URL | Request) => {
  calls.push(String(input))
  fetched?.()
  return new Promise<Response>((resolve) => { respond = resolve })
}) as typeof fetch
const response = (data: unknown, status = 200) => new Response(JSON.stringify(
  status === 200 ? { success: true, data } : { success: false, error: { code: 'INTERNAL_ERROR', message: 'sheet unavailable' } },
), { status, headers: { 'Content-Type': 'application/json' } })
const rows = [{
  orderId: 'o1', customerId: 'cus-1', orderNumber: null, invoiceNumber: null,
  receivedDate: '2026-10-05', dueDate: null, createdAt: null,
  serviceType: 'WSIR', status: 'PENDING', quantity: 3, note: null,
}]
setActivePinia(createPinia())
const store = useOrderSnapshotStore()
try {
  assert.equal(store.orders, null)
  assert.deepEqual(cachePolicyFor('/api/order-snapshots'), { cacheable: false, hours: 0, persist: false })
  writeCache('/api/order-snapshots?request=1', ['stale'])
  const first = store.load()
  const concurrent = store.load()
  assert.equal(store.loading, true)
  await fetchStarted
  assert.deepEqual(calls, ['/api/order-snapshots?request=1'], 'concurrent loads share one fetch')
  assert.equal(store.orders, null, 'no response cache supplies the snapshot')
  respond!(response(rows))
  await Promise.all([first, concurrent])
  assert.deepEqual(store.orders, rows)
  assert.equal(store.loading, false)
  assert.equal(store.error, null)
  assert.equal(readCache('/api/order-snapshots?request=1'), null, 'snapshot responses are never cached')

  fetchStarted = new Promise<void>((resolve) => { fetched = resolve })
  const failed = store.load()
  await fetchStarted
  assert.equal(calls.length, 2, 'a later load always requests a fresh snapshot')
  respond!(response(null, 500))
  await failed
  assert.deepEqual(store.orders, rows, 'failure keeps the previous orders')
  assert.equal(store.error, 'sheet unavailable')
  assert.equal(store.loading, false)

  fetchStarted = new Promise<void>((resolve) => { fetched = resolve })
  invalidate('/api/work-orders')
  assert.equal(store.loading, true, 'work-order invalidation starts a reload')
  assert.equal(store.error, null)
  await fetchStarted
  assert.equal(calls.length, 3)
  const invalidationLoad = store.load()
  respond!(response([]))
  await invalidationLoad
  assert.deepEqual(store.orders, [], 'successful reload replaces the snapshot')
  store.$dispose()
  invalidate('/api/work-orders')
  await Promise.resolve()
  assert.equal(calls.length, 3, 'disposing the store removes the invalidation listener')
  console.log('order-snapshot store dry test passed')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
