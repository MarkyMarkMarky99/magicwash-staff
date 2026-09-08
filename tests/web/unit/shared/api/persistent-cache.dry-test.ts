import assert from 'node:assert/strict'

// The persisted layer only exists to survive a page reload, and the two things that
// can go wrong with it are silent: a reload that resurrects data the app can no longer
// read, and a reload that makes a stale entry look fresh because it was re-timestamped
// on the way in. Both are asserted here.
//
// Node has no localStorage, so a stub is installed BEFORE the modules load —
// persistent-cache.ts purges other versions at import time, and the import must see it.

interface StubStore {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
}

function makeStorage(quotaBytes = Infinity): StubStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    get length() {
      return raw.size
    },
    key: (index: number) => [...raw.keys()][index] ?? null,
    getItem: (key: string) => raw.get(key) ?? null,
    setItem(key: string, value: string) {
      const used = [...raw.entries()].reduce(
        (sum, [k, v]) => sum + (k === key ? 0 : k.length + v.length),
        0,
      )
      if (used + key.length + value.length > quotaBytes) {
        throw new Error('QuotaExceededError')
      }
      raw.set(key, value)
    },
    removeItem: (key: string) => void raw.delete(key),
    clear: () => raw.clear(),
  }
}

const store = makeStorage()
;(globalThis as { localStorage?: unknown }).localStorage = store

// An entry left by an older deploy, under a version this build no longer speaks.
store.raw.set('mw-cache:0:/api/customers', JSON.stringify({ v: [{ old: true }], t: Date.now() }))
// Something else in the app entirely — the reporter name the refresh button must keep.
store.raw.set('issue-report:reporter', 'Mark')

const { readPersisted, writePersisted, clearPersisted, persistedStats } = await import(
  '@/shared/api/persistent-cache'
)
const { readCache, writeCache, invalidate, cacheStats } = await import(
  '@/shared/api/response-cache'
)

// --- a foreign version is purged on load, unrelated keys are not --------------------
assert.equal(
  store.raw.has('mw-cache:0:/api/customers'),
  false,
  'entries from an older storage version are dropped at import',
)
assert.equal(
  store.raw.get('issue-report:reporter'),
  'Mark',
  'keys outside the cache namespace are never touched',
)

// --- round trip ----------------------------------------------------------------------
writePersisted('/api/customers', [{ customerId: 'CUS-1' }], 1_000)
const stored = readPersisted('/api/customers')
assert.ok(stored, 'a persisted entry reads back')
assert.deepEqual(stored.value, [{ customerId: 'CUS-1' }], 'value survives the round trip')
assert.equal(stored.storedAt, 1_000, 'the original timestamp is stored, not the read time')
assert.equal(readPersisted('/api/price-list'), null, 'an unwritten endpoint returns null')

// --- corrupt entries are discarded, not thrown on ------------------------------------
store.raw.set('mw-cache:1:/api/price-list', '{not json')
assert.equal(readPersisted('/api/price-list'), null, 'unparseable JSON reads as a miss')
store.raw.set('mw-cache:1:/api/price-list', JSON.stringify({ v: [], t: 'yesterday' }))
assert.equal(readPersisted('/api/price-list'), null, 'a wrong-shaped entry reads as a miss')

clearPersisted()
assert.equal(persistedStats().entries, 0, 'clearPersisted() with no argument empties the namespace')
assert.equal(store.raw.get('issue-report:reporter'), 'Mark', 'and still leaves other keys alone')

// --- only endpoints marked persist reach storage --------------------------------------
invalidate()
writeCache('/api/customers', [{ customerId: 'CUS-2' }])
writeCache('/api/work-orders?page=1', { items: [] })
assert.ok(readPersisted('/api/customers'), 'a persisted endpoint is mirrored to storage')
assert.equal(
  readPersisted('/api/work-orders?page=1'),
  null,
  'an endpoint outside PERSIST_ENDPOINTS stays in memory only',
)

// --- a reload reads back from storage, without re-dating the entry --------------------
const writtenAt = readPersisted('/api/customers')?.storedAt
assert.ok(typeof writtenAt === 'number', 'the write recorded when the response arrived')
assert.ok(readCache('/api/customers'), 'the entry is readable while still in memory')

invalidateMemoryOnly()
const promoted = readCache<{ customerId: string }[]>('/api/customers')
assert.ok(promoted, 'a memory miss falls through to storage')
assert.deepEqual(promoted.value, [{ customerId: 'CUS-2' }], 'the stored value comes back intact')
assert.equal(cacheStats().entries, 1, 'and is promoted into memory so the next read is local')
// Freshness is judged from when the response arrived, not from when it was read back.
// This is the whole point of the layer: a reload must not resurrect an expired entry as
// a fresh one, which would hide an edit made on another device for a full hour.
assert.equal(
  readPersisted('/api/customers')?.storedAt,
  writtenAt,
  'promotion does not re-date the stored entry',
)
assert.equal(promoted.fresh, true, 'a copy stored moments ago survives the reload as fresh')

// The same URL, stored two hours ago, is past the one-hour window it was written under.
invalidate()
writePersisted('/api/customers', [{ customerId: 'CUS-3' }], Date.now() - 2 * 60 * 60 * 1000)
const expired = readCache<{ customerId: string }[]>('/api/customers')
assert.ok(expired, 'an expired entry is still served, so the page never waits on the network')
assert.equal(expired.fresh, false, 'but it is reported stale, so the caller revalidates')

// --- invalidate clears both layers -----------------------------------------------------
invalidate('/api/customers')
assert.equal(readPersisted('/api/customers'), null, 'invalidate(path) clears the stored copy too')
assert.equal(readCache('/api/customers'), null, 'and nothing is promoted back afterwards')

// --- a full quota degrades to memory-only, it does not throw ---------------------------
const tiny = makeStorage(200)
;(globalThis as { localStorage?: unknown }).localStorage = tiny
writeCache('/api/customers', [{ customerId: 'x'.repeat(500) }])
assert.ok(readCache('/api/customers'), 'the read still succeeds from memory when storage is full')
assert.equal(tiny.raw.size, 0, 'and nothing oversized was forced into storage')

invalidate()
console.log('persistent-cache.dry-test: OK')

/** Simulate a page reload: memory starts empty, storage does not. */
function invalidateMemoryOnly(): void {
  const kept = new Map(store.raw)
  invalidate()
  store.raw.clear()
  for (const [key, value] of kept) store.raw.set(key, value)
}
