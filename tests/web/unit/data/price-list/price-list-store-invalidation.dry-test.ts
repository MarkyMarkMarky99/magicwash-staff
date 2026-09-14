import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { invalidate } from '@/shared/api/response-cache'

const originalFetch = globalThis.fetch
let generation = 0
globalThis.fetch = (async () => {
  generation += 1
  return new Response(JSON.stringify({
    data: [{ id: `row-${generation}` }],
    meta: { pagination: { page: 1, perPage: 1000 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

try {
  invalidate('/api/price-list')
  setActivePinia(createPinia())
  const store = usePriceListStore()
  await store.load()
  assert.equal(store.items[0]?.id, 'row-1')

  invalidate('/api/price-list')
  await store.load(true)
  assert.equal(store.items[0]?.id, 'row-2', 'a loaded store re-reads after external invalidation')
  store.$dispose()
} finally {
  globalThis.fetch = originalFetch
}

console.log('price-list-store-invalidation.dry-test: OK')
