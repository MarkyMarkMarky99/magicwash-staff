import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useOrderPriceListStore } from '@/features/orders/stores/order-price-list.store'
import type { OrderPriceListItemDto } from '@/features/orders/services/order-price-list.service'

const row = (id: string, overrides: Partial<OrderPriceListItemDto> = {}): OrderPriceListItemDto => ({
  id, itemCode: id, category: 'Clothing', subcategory: 'Shirts', itemType: 'Shirt', variant: null,
  displayNameTh: 'เสื้อ', displayNameEn: 'Shirt', serviceType: 'WSIR', priceGroup: 'DEFAULT',
  unit: 'ชิ้น', price: 35.5, creditEligible: false, effectiveFrom: '2026-01-01', effectiveTo: null,
  active: true, ...overrides,
})
const response = (rows: OrderPriceListItemDto[]) => new Response(JSON.stringify({
  success: true, data: rows, meta: { pagination: { page: 1, perPage: 1000 } },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

const originalFetch = globalThis.fetch
const pending: { url: URL; resolve: (response: Response) => void; reject: (error: Error) => void }[] = []
globalThis.fetch = ((input: string | URL | Request) => new Promise<Response>((resolve, reject) => {
  pending.push({ url: new URL(String(input), 'http://localhost'), resolve, reject })
})) as typeof fetch
setActivePinia(createPinia())
const store = useOrderPriceListStore()
try {
  const load = store.reload('WSIR')
  assert.equal(store.loading, true)
  assert.equal(pending[0]!.url.pathname, '/api/price-list')
  assert.equal(pending[0]!.url.searchParams.get('serviceType'), 'WSIR')
  assert.equal(pending[0]!.url.searchParams.get('priceGroup'), 'DEFAULT')
  assert.equal(pending[0]!.url.searchParams.get('perPage'), '1000')
  pending[0]!.resolve(response([row('active'), row('inactive', { active: false }),
    row('other-service', { serviceType: 'DRCL' }), row('other-group', { priceGroup: 'VIP' })]))
  await load
  assert.deepEqual(store.items.map(item => item.id), ['active'])
  assert.equal(store.items[0]!.price, 35.5)
  assert.equal(store.loading, false)

  const oldLoad = store.reload('WSIR')
  const newerLoad = store.reload('IRON')
  pending[2]!.resolve(response([row('iron', { serviceType: 'IRON' })]))
  await newerLoad
  pending[1]!.resolve(response([row('stale')]))
  await oldLoad
  assert.deepEqual(store.items.map(item => item.id), ['iron'])

  const cancelled = store.reload('WSIR')
  store.reset()
  pending[3]!.reject(new Error('late failure'))
  await cancelled
  assert.equal(store.error, null)
  assert.equal(store.loading, false)
  assert.deepEqual(store.items, [])

  const failed = store.reload('WSIR')
  pending[4]!.reject(new Error('connection lost'))
  await failed
  assert.equal(store.error, 'connection lost')
  const retry = store.reload('WSIR')
  assert.equal(store.error, null)
  pending[5]!.resolve(response(Array.from({ length: 1000 }, (_, i) => row(String(i)))))
  await retry
  assert.equal(store.items.length, 1000)
  assert.equal(store.truncated, true)
  store.reset()
  assert.equal(store.truncated, false)
  console.log('order-price-list.store.dry-test: OK (eligibility, request, stale success/failure, reset, retry, cap)')
} finally {
  globalThis.fetch = originalFetch
}
