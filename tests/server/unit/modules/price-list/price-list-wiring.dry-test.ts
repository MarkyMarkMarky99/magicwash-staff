import assert from 'node:assert/strict'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> }> = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

function response(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => text,
    json: async () => ({}),
  } as Response
}

function gvizBody(values: unknown[] = []): string {
  const columns = Array.from({ length: 16 }, (_, index) => ({
    id: String.fromCharCode(65 + index),
  }))

  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: columns,
      rows:
        values.length === 0
          ? []
          : [{ c: values.map((value) => (value === null ? null : { v: value })) }],
    },
  })});`
}

async function withMockFetch<T>(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
    const stringUrl = String(url)
    calls.push({ url: stringUrl, init })
    return handler(stringUrl, init)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function productionPriceListModule() {
  process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-test-spreadsheet'
  return import('../../../../../server/modules/price-list/price-list.module.js')
}

test('importing the Price List module does not require its spreadsheet environment value', async () => {
  const previousSpreadsheetId = process.env.PRICE_LIST_SPREADSHEET_ID
  delete process.env.PRICE_LIST_SPREADSHEET_ID

  try {
    await assert.doesNotReject(async () =>
      import('../../../../../server/modules/price-list/price-list.module.js'),
    )
  } finally {
    if (previousSpreadsheetId === undefined) {
      delete process.env.PRICE_LIST_SPREADSHEET_ID
    } else {
      process.env.PRICE_LIST_SPREADSHEET_ID = previousSpreadsheetId
    }
  }
})

test('production wiring uses BaseCrudService and exposes collection plus update routes', async () => {
  const priceListModule = await productionPriceListModule()

  assert.ok(priceListModule.priceListService instanceof BaseCrudService)
  assert.equal(priceListModule.priceListService.constructor.name, 'BaseCrudService')
  assert.ok(priceListModule.priceListRoutes.collection)
  assert.ok(priceListModule.priceListRoutes.item)
  assert.equal(
    Object.keys(priceListModule).some((name) => /transform|jsonColumns/i.test(name)),
    false,
  )
})

test('list maps the physical itemtype column to itemType and preserves null, false, zero, and API dates', async () => {
  const { priceListService } = await productionPriceListModule()
  const values = [
    'price-001',
    'SHIRT-001',
    'tops',
    'shirt',
    'itemtype-from-db',
    null,
    'เสื้อเชิ้ต',
    'Shirt',
    'WSIR',
    'DEFAULT',
    'piece',
    0,
    false,
    'Date(2026,0,1)',
    null,
    false,
  ]

  await withMockFetch(
    async () => response(gvizBody(values)),
    async (calls) => {
      const result = await priceListService.list({ page: 1, perPage: 20 })

      assert.deepEqual(result.items, [
        {
          id: 'price-001',
          itemCode: 'SHIRT-001',
          category: 'tops',
          subcategory: 'shirt',
          itemType: 'itemtype-from-db',
          variant: null,
          displayNameTh: 'เสื้อเชิ้ต',
          displayNameEn: 'Shirt',
          serviceType: 'WSIR',
          priceGroup: 'DEFAULT',
          unit: 'piece',
          price: 0,
          creditEligible: false,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          active: false,
        },
      ])
      assert.deepEqual(result.pagination, { page: 1, perPage: 20 })
      assert.deepEqual(Object.keys(result.items[0] as object), [
        'id',
        'itemCode',
        'category',
        'subcategory',
        'itemType',
        'variant',
        'displayNameTh',
        'displayNameEn',
        'serviceType',
        'priceGroup',
        'unit',
        'price',
        'creditEligible',
        'effectiveFrom',
        'effectiveTo',
        'active',
      ])
      assert.equal(calls.length, 1)
    },
  )
})

test('production wiring exposes no delete route', async () => {
  const { priceListRoutes } = await productionPriceListModule()
  const collectionDelete = await priceListRoutes.collection.handleRequest({
    method: 'DELETE',
    query: {},
    body: undefined,
    headers: {},
    params: {},
  })
  assert.equal(collectionDelete.status, 405)
  assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

  const itemDelete = await priceListRoutes.item?.handleRequest({
    method: 'DELETE',
    query: {},
    body: undefined,
    headers: {},
    params: { id: 'a1b2c3d4' },
  })
  assert.ok(itemDelete)
  assert.equal(itemDelete.status, 405)
  assert.equal(itemDelete.headers?.Allow, 'PATCH')
})

test('dirty legacy string cells remain readable without changing the declared response values', async () => {
  const { priceListService } = await productionPriceListModule()
  const values = [
    'legacy-row',
    'LEGACY-001',
    'legacy-category',
    '',
    'legacy-itemtype',
    '',
    'Legacy display name',
    '',
    'legacy-service',
    '',
    '',
    0,
    false,
    'Date(2025,11,31)',
    'Date(2026,11,31)',
    false,
  ]

  await withMockFetch(
    async () => response(gvizBody(values)),
    async () => {
      await assert.doesNotReject(async () => priceListService.list({ page: 1, perPage: 1 }))
    },
  )
})

test('list queries use physical GViz columns for all keyword fields, equality filters, and sort', async () => {
  const { priceListService } = await productionPriceListModule()

  await withMockFetch(
    async () => response(gvizBody()),
    async (calls) => {
      await priceListService.list({
        keyword: 'shirt',
        itemCode: 'SHIRT-001',
        category: 'tops',
        subcategory: 'shirt',
        itemType: 'wash',
        serviceType: 'WSIR',
        priceGroup: 'DEFAULT',
        page: 2,
        perPage: 5,
        sortBy: 'displayNameTh',
        sortOrder: 'desc',
      })

      const query = new URL(calls[0].url).searchParams.get('tq') ?? ''
      for (const physicalColumn of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
        assert.match(query, new RegExp(`\\b${physicalColumn}\\b`), physicalColumn)
      }
      assert.match(query, /order by G desc/i)

      for (const apiField of [
        'itemCode',
        'subcategory',
        'itemType',
        'displayNameTh',
        'effectiveFrom',
      ]) {
        assert.equal(query.includes(apiField), false, `GViz query leaked API field ${apiField}`)
      }
    },
  )
})

test('every public price-list sort field maps to its physical GViz column', async () => {
  const { priceListService } = await productionPriceListModule()
  const expectedColumns = {
    itemCode: 'B', category: 'C', subcategory: 'D', itemType: 'E', displayNameTh: 'G',
    serviceType: 'I', priceGroup: 'J', price: 'L', effectiveFrom: 'N',
  } as const

  await withMockFetch(
    async () => response(gvizBody()),
    async (calls) => {
      for (const [sortBy, column] of Object.entries(expectedColumns)) {
        await priceListService.list({ page: 1, perPage: 1, sortBy, sortOrder: 'asc' })
        const query = new URL(calls.at(-1)!.url).searchParams.get('tq') ?? ''
        assert.match(query, new RegExp(`order by ${column} asc`, 'i'), sortBy)
      }
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} price-list wiring dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
