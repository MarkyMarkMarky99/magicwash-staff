import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/price-list/services/price-list.service.ts', import.meta.url),
  'utf8',
)
assert.match(source, /listAllPriceList/)
assert.match(source, /apiGetList/)
assert.match(source, /priceListListQuerySchema/)
assert.match(source, /perPage\s*:\s*1000/)

const { listAllPriceList } = await import('@/features/price-list/services/price-list.service')

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
    const url = new URL(String(input), 'http://localhost')
    calls.push(url)
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
  const result = await listAllPriceList()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.pathname, '/api/price-list')
  assert.equal(calls[0]!.searchParams.get('perPage'), '1000')
  assert.deepEqual(result, { items: [row('one')], truncated: false })
})

const cappedRows = Array.from({ length: 1000 }, (_, index) => row(`row-${index}`))
await withMockFetch(cappedRows, async (calls) => {
  const result = await listAllPriceList()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.searchParams.get('perPage'), '1000')
  assert.equal(result.items.length, 1000)
  assert.equal(result.truncated, true)
})

console.log('price-list.service.dry-test: OK')
