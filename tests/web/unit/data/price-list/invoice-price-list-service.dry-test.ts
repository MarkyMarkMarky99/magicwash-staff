import assert from 'node:assert/strict'

import { listPriceList } from '@/data/price-list/price-list.service'
import { invalidate } from '@/shared/api/response-cache'

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

async function withMockFetch(
  rows: PriceListRow[],
  run: (calls: URL[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: URL[] = []
  globalThis.fetch = (async (input: URL | string) => {
    calls.push(new URL(String(input), 'http://localhost'))
    return new Response(JSON.stringify({
      data: rows,
      meta: { pagination: { page: 1, perPage: 1000 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withMockFetch([row('one')], async (calls) => {
  invalidate('/api/price-list')
  const [invoiceResult, orderResult] = await Promise.all([listPriceList(), listPriceList()])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.pathname, '/api/price-list')
  assert.equal(calls[0]!.searchParams.get('perPage'), '1000')
  assert.equal(calls[0]!.searchParams.get('priceGroup'), null)
  assert.equal(calls[0]!.searchParams.get('serviceType'), null)
  assert.equal(calls[0]!.searchParams.get('sortBy'), 'itemCode')
  assert.deepEqual(invoiceResult, { items: [row('one')], truncated: false })
  assert.deepEqual(orderResult, invoiceResult)
})

const cappedRows = Array.from({ length: 1000 }, (_, index) => row(`row-${index}`))
await withMockFetch(cappedRows, async (calls) => {
  invalidate('/api/price-list')
  const result = await listPriceList()
  assert.equal(calls.length, 1)
  assert.equal(result.items.length, 1000)
  assert.equal(result.truncated, true)
})

console.log('invoice-price-list-service.dry-test: OK (canonical URL shared)')
