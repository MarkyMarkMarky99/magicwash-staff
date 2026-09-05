import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/invoices/services/invoice-price-list.service.ts', import.meta.url),
  'utf8',
)
assert.match(source, /apiGetList/)
assert.match(source, /perPage\s*:\s*1000/)
assert.match(source, /priceGroup\s*:\s*['"]DEFAULT['"]/)
assert.match(source, /sortBy\s*:\s*['"]itemCode['"]/)
assert.match(source, /truncated/)
assert.doesNotMatch(source, /features\/price-list/)

const invoicePriceListModule = await import(
  '@/features/invoices/services/invoice-price-list.service'
)
const exportedFunctions = Object.entries(invoicePriceListModule).filter(
  ([, value]) => typeof value === 'function',
)
assert.equal(exportedFunctions.length, 1, 'invoice price-list service must expose one list operation')
const listInvoicePriceList = exportedFunctions[0]![1] as () => Promise<{
  items: Record<string, unknown>[]
  truncated: boolean
}>

const row = (id: string): Record<string, unknown> => ({
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
  rows: Record<string, unknown>[],
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
  const result = await listInvoicePriceList()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.pathname, '/api/price-list')
  assert.equal(calls[0]!.searchParams.get('perPage'), '1000')
  assert.equal(calls[0]!.searchParams.get('priceGroup'), 'DEFAULT')
  assert.equal(calls[0]!.searchParams.get('sortBy'), 'itemCode')
  assert.deepEqual(result, { items: [row('one')], truncated: false })
})

const cappedRows = Array.from({ length: 1000 }, (_, index) => row(`row-${index}`))
await withMockFetch(cappedRows, async (calls) => {
  const result = await listInvoicePriceList()
  assert.equal(calls.length, 1)
  assert.equal(result.items.length, 1000)
  assert.equal(result.truncated, true)
})

console.log('invoice-price-list.service.dry-test: OK')
