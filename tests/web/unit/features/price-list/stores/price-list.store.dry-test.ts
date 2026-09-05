import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'

import { usePriceListStore } from '@/features/price-list/stores/price-list.store'

/**
 * Executable, not a source scan. An earlier version of this guard only regex-matched
 * the store's source, so swapping the `listAllPriceList()` call site for the paged
 * `listPriceList()` left it green — the import line still contained the symbol.
 * Driving the real store through a stubbed `fetch` catches that: the two services
 * send different `perPage` values, so the request itself proves which one ran.
 */

type PriceListRow = Record<string, unknown>

const row = (id: string): PriceListRow => ({
  id,
  itemCode: 'ITM-0001',
  category: 'Bedding',
  subcategory: 'Pillows',
  itemType: 'Pillow',
  variant: null,
  displayNameTh: 'หมอน',
  displayNameEn: 'Pillow',
  serviceType: 'WSIR',
  priceGroup: 'DEFAULT',
  unit: 'piece',
  price: 0,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
})

interface Call {
  url: URL
  method: string
}

async function withStore(
  listRows: PriceListRow[],
  run: (store: ReturnType<typeof usePriceListStore>, calls: Call[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: Call[] = []

  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url: new URL(String(input), 'http://localhost'), method })

    if (method === 'GET') {
      return new Response(
        JSON.stringify({ data: listRows, meta: { pagination: { page: 1, perPage: 1000 } } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ data: row('created') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  setActivePinia(createPinia())
  try {
    await run(usePriceListStore(), calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

const createPayload = {
  category: 'Bedding',
  subcategory: 'Pillows',
  itemType: 'Pillow',
  displayNameTh: 'หมอน',
  serviceType: 'WSIR',
  priceGroup: 'DEFAULT',
  price: 120,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  active: true,
} as never

// A complete load goes through listAllPriceList — one request, the whole catalogue.
await withStore([row('a'), row('b')], async (store, calls) => {
  await store.load()

  assert.equal(calls.length, 1, 'load must issue exactly one request')
  assert.equal(calls[0]!.url.pathname, '/api/price-list')
  assert.equal(
    calls[0]!.url.searchParams.get('perPage'),
    '1000',
    'the store must load the whole catalogue, not a default-sized page',
  )
  assert.equal(store.items.length, 2)
  assert.equal(store.truncated, false)
  assert.equal(store.loaded, true)
  assert.equal(store.error, null)

  await store.load()
  assert.equal(calls.length, 1, 'a completed load must not refetch')
})

// A response that fills the cap may be incomplete: surface it and do not claim loaded.
const cappedRows = Array.from({ length: 1000 }, (_, index) => row(`row-${index}`))
await withStore(cappedRows, async (store) => {
  await store.load()

  assert.equal(store.truncated, true)
  assert.equal(store.loaded, false, 'a truncated catalogue must not be marked loaded')
  assert.ok(store.error, 'a truncated catalogue must surface a load error')
})

// Regression: a mutation must not wipe the truncation error and imply a complete list.
await withStore(cappedRows, async (store) => {
  await store.load()
  const truncationError = store.error
  assert.ok(truncationError)

  await store.create(createPayload)

  assert.equal(store.truncated, true, 'creating an item does not complete the catalogue')
  assert.equal(store.loaded, false)
  assert.equal(
    store.error,
    truncationError,
    'the truncation error must survive a successful mutation',
  )
})

// On a complete catalogue the same mutation clears the stale error as before.
await withStore([row('a')], async (store) => {
  await store.load()
  await store.create(createPayload)

  assert.equal(store.error, null)
  assert.equal(store.loaded, true)
  assert.equal(store.items.length, 2, 'a created row is appended to the loaded list')
})

console.log('price-list.store.dry-test: OK')
