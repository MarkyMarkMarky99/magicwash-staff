import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { invalidate } from '@/shared/api/response-cache'

type PriceListRow = Record<string, unknown>

const row = (id: string, price: number): PriceListRow => ({
  id,
  itemCode: `ITM-${id.padStart(4, '0')}`,
  category: 'Bedding',
  subcategory: 'Pillows',
  itemType: 'Pillow',
  variant: null,
  displayNameTh: 'หมอน',
  displayNameEn: 'Pillow',
  serviceType: 'WSIR',
  priceGroup: 'DEFAULT',
  unit: 'piece',
  price,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
  imageUrl: null,
})

const listResponse = (rows: PriceListRow[]) => new Response(JSON.stringify({
  data: rows,
  meta: { pagination: { page: 1, perPage: 1000 } },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

const writeResponse = (persisted: PriceListRow) => new Response(JSON.stringify({ data: persisted }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

async function testLaggingWrite(
  method: 'POST' | 'PATCH',
  initial: PriceListRow[],
  persisted: PriceListRow,
): Promise<void> {
  const originalFetch = globalThis.fetch
  let getCount = 0
  let resolveReload: ((response: Response) => void) | undefined
  let signalReloadStarted: (() => void) | undefined
  const reloadStarted = new Promise<void>((resolve) => { signalReloadStarted = resolve })

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const requestMethod = init?.method ?? 'GET'
    if (requestMethod === 'GET') {
      getCount += 1
      if (getCount === 1) return listResponse(initial)
      signalReloadStarted?.()
      return new Promise<Response>((resolve) => { resolveReload = resolve })
    }
    assert.equal(requestMethod, method)
    return writeResponse(persisted)
  }) as typeof fetch

  invalidate('/api/price-list')
  setActivePinia(createPinia())
  const store = usePriceListStore()
  try {
    await store.load()
    const mutation = method === 'POST'
      ? store.create({
          category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow',
          displayNameTh: 'หมอน', serviceType: 'WSIR', priceGroup: 'DEFAULT',
          price: Number(persisted.price), creditEligible: false,
          effectiveFrom: '2026-01-01', active: true,
        })
      : store.update(String(persisted.id), { price: Number(persisted.price) })

    await reloadStarted
    for (let turn = 0; turn < 4; turn += 1) await Promise.resolve()
    assert.deepEqual(
      store.items.find((item) => item.id === persisted.id),
      persisted,
      'the write response must update the shared list before its re-read finishes',
    )

    resolveReload?.(listResponse(initial))
    await mutation
    assert.deepEqual(
      store.items.find((item) => item.id === persisted.id),
      persisted,
      'a lagging canonical read must not remove or revert the persisted write row',
    )
    assert.equal(store.loading, false)
    assert.equal(store.error, null)
  } finally {
    store.$dispose()
    globalThis.fetch = originalFetch
  }
}

await testLaggingWrite('POST', [row('1', 100)], row('2', 200))
await testLaggingWrite('PATCH', [row('1', 100)], row('1', 250))

async function testMutationFailure(method: 'POST' | 'PATCH', expectedError: string): Promise<void> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') return listResponse([row('1', 100)])
    throw 'write failed'
  }) as typeof fetch

  invalidate('/api/price-list')
  setActivePinia(createPinia())
  const store = usePriceListStore()
  try {
    await store.load()
    const mutation = method === 'POST'
      ? store.create({
          category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow',
          displayNameTh: 'หมอน', serviceType: 'WSIR', priceGroup: 'DEFAULT',
          price: 200, creditEligible: false, effectiveFrom: '2026-01-01', active: true,
        })
      : store.update('1', { price: 250 })
    assert.equal(store.loading, true, 'mutation loading starts immediately')
    await assert.rejects(mutation)
    assert.equal(store.loading, false, 'mutation loading stops after failure')
    assert.equal(store.error, expectedError)
  } finally {
    store.$dispose()
    globalThis.fetch = originalFetch
  }
}

await testMutationFailure('POST', 'Unable to create price list item')
await testMutationFailure('PATCH', 'Unable to update price list item')

console.log('price-list-write-reconciliation.dry-test: OK')
