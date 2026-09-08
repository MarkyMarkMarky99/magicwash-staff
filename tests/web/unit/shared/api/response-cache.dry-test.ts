import assert from 'node:assert/strict'
import { CACHE_MAX_BYTES } from '@/shared/config/cache'
import { cacheStats, invalidate, readCache, writeCache } from '@/shared/api/response-cache'

// The cache is the first thing in this app that can grow without bound: every feature
// store holds a single slot and overwrites it, while this is keyed by URL and keeps one
// entry per distinct filter. The ceiling and the eviction order are the whole safety
// argument, so they are asserted here rather than assumed.

invalidate()

// --- round trip ---------------------------------------------------------------------
writeCache('/api/work-orders?page=1', { items: [1, 2] })
const hit = readCache<{ items: number[] }>('/api/work-orders?page=1')
assert.ok(hit, 'a written entry reads back')
assert.deepEqual(hit.value, { items: [1, 2] }, 'value survives the round trip')
assert.equal(readCache('/api/work-orders?page=2'), null, 'a different query is a different entry')

// --- freshness follows the configured policy ----------------------------------------
// Every endpoint sits at 0 hours while the cache is being introduced: still cached, but
// never counted as fresh, so it is served immediately AND revalidated on every read.
// That keeps network behaviour identical to before the cache existed.
assert.equal(hit.fresh, false, 'a 0-hour endpoint is always stale')

writeCache('/api/customers', [{ customerId: 'CUS-1' }])
const customers = readCache('/api/customers')
assert.ok(customers, 'endpoints marked for persistence cache the same way')
assert.equal(customers.fresh, false, 'no endpoint is exempt from revalidating yet')

// --- invalidate clears an endpoint and all of its filtered variants -------------------
writeCache('/api/customers?keyword=a', [])
writeCache('/api/customers/CUS-1', {})
invalidate('/api/customers')
assert.equal(readCache('/api/customers'), null, 'invalidate clears the base path')
assert.equal(readCache('/api/customers?keyword=a'), null, 'invalidate clears query variants')
assert.equal(readCache('/api/customers/CUS-1'), null, 'invalidate clears nested paths')
assert.ok(readCache('/api/work-orders?page=1'), 'invalidate leaves other endpoints alone')

// Endpoint prefixes stop at query and path boundaries, never at a shared word prefix.
writeCache('/api/packages', [])
writeCache('/api/customer-packages', [])
invalidate('/api/packages')
assert.equal(readCache('/api/packages'), null, 'invalidate clears the requested endpoint')
assert.ok(readCache('/api/customer-packages'), 'packages and customer packages are separate endpoints')

writeCache('/api/order-items', [])
writeCache('/api/order-images', [])
invalidate('/api/order-items')
assert.equal(readCache('/api/order-items'), null, 'invalidate clears the matching sibling endpoint')
assert.ok(readCache('/api/order-images'), 'a prefix match does not leak across sibling endpoints')

invalidate()
assert.equal(cacheStats().entries, 0, 'invalidate() with no argument clears everything')
assert.equal(cacheStats().bytes, 0, 'byte total resets with the entries')

// --- a single oversized response is skipped, not cached at any cost -------------------
writeCache('/api/huge', { blob: 'x'.repeat(CACHE_MAX_BYTES + 1) })
assert.equal(readCache('/api/huge'), null, 'a response past the whole budget is not stored')
assert.equal(cacheStats().entries, 0, 'and leaves nothing behind')

// --- eviction drops the least recently USED entry, not the oldest written ------------
const chunk = (label: string) => ({ blob: label.repeat(Math.floor(CACHE_MAX_BYTES / 3)) })

writeCache('/api/a', chunk('a'))
writeCache('/api/b', chunk('b'))
assert.equal(cacheStats().entries, 2, 'two thirds of the budget fits')

// Touch `a` so `b` becomes the coldest entry despite being written later.
readCache('/api/a')
writeCache('/api/c', chunk('c'))

assert.ok(cacheStats().bytes <= CACHE_MAX_BYTES, 'total stays under the ceiling')
assert.ok(readCache('/api/c'), 'the newest entry is kept')
assert.ok(readCache('/api/a'), 'a recently read entry survives')
assert.equal(readCache('/api/b'), null, 'the least recently used entry is evicted first')

invalidate()
console.log('response-cache.dry-test: OK')
