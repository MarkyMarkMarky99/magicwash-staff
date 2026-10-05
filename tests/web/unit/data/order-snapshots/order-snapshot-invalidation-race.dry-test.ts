import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { createPinia, setActivePinia } from 'pinia'
import { useOrderSnapshotStore } from '@/data/order-snapshots/order-snapshot.store'
import { invalidate } from '@/shared/api/response-cache'

const originalFetch = globalThis.fetch
const resolvers: Array<(response: Response) => void> = []
globalThis.fetch = (async () => new Promise<Response>((resolve) => { resolvers.push(resolve) })) as typeof fetch
async function waitForRequests(count: number) {
  for (let i = 0; i < 200 && resolvers.length < count; i += 1) await setImmediate()
}
const respond = (index: number, orderId: string) => resolvers[index]!(new Response(
  JSON.stringify({ success: true, data: [{ orderId }] }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
))

setActivePinia(createPinia())
const store = useOrderSnapshotStore()
try {
  // A page opens and starts a load; an edit then invalidates before that load returns.
  const opened = store.load()
  await waitForRequests(1)
  invalidate('/api/work-orders')
  await waitForRequests(2)
  assert.equal(resolvers.length, 2, 'invalidation during a load starts a new request')
  const joined = [store.load(), store.load()]
  await waitForRequests(3)
  assert.equal(resolvers.length, 2, 'later loads join the newest request')

  respond(1, 'after-edit')
  await setImmediate()
  respond(0, 'before-edit')
  await Promise.all([opened, ...joined])
  await setImmediate()
  assert.deepEqual(store.orders, [{ orderId: 'after-edit' }], 'the pre-edit response never overwrites the post-edit one')
  assert.equal(store.loading, false)
  console.log('order-snapshot invalidation race dry test passed')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
