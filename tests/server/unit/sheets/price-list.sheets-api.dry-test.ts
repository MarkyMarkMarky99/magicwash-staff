import assert from 'node:assert/strict'
import { priceListDbContract, priceListRowSchema } from '../../../../server/sheets/PriceList/PriceList.db-contract.js'
import { SheetRepository } from '../../../../server/shared/repositories/sheet.repository.js'

process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-sheet-test-spreadsheet'

type PriceListRow = typeof priceListRowSchema['_output']
interface FetchCall {
  url: string
  init?: RequestInit
}

const headers = Object.keys(priceListRowSchema.shape)
const existingRow = [
  'a1b2c3d4',
  'ITM-0012',
  'tops',
  'shirt',
  'wash',
  'standard',
  'เสื้อเชิ้ต',
  'Shirt',
  'WSIR',
  'DEFAULT',
  'piece',
  75,
  true,
  '2026-01-01',
  null,
  true,
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function apiPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname)
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>
}

function createRepository(): SheetRepository<PriceListRow> {
  return new SheetRepository<PriceListRow>({
    contract: priceListDbContract,
    sheetsApiClientOptions: {
      fetchImpl: globalThis.fetch,
      accessTokenProvider: async () => 'price-list-test-access-token',
    },
  })
}

async function withMockSheets(
  handler: (call: FetchCall) => Promise<Response>,
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)
    return handler(call)
  }) as typeof fetch

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withMockSheets(
  async (call) => {
    const path = apiPath(call.url)
    if (call.init?.method === 'GET' && path.endsWith('/values/PriceList!1:1')) {
      return jsonResponse({ values: [headers] })
    }
    if (call.init?.method === 'GET' && path.endsWith('/values/PriceList!A:A')) {
      return jsonResponse({ values: [['id'], ['a1b2c3d4']] })
    }
    if (call.init?.method === 'POST' && path.endsWith('/values/PriceList!A:A:append')) {
      const body = requestBody(call)
      assert.deepEqual(body.values, [
        [
          'z9y8x7w6',
          'ITM-0013',
          'bottoms',
          'trousers',
          'wash',
          '',
          'กางเกง',
          '',
          'WASH',
          'DEFAULT',
          '',
          90,
          false,
          '2026-02-03',
          '',
          true,
        ],
      ])
      return jsonResponse({
        spreadsheetId: process.env.PRICE_LIST_SPREADSHEET_ID,
        updates: {
          updatedRows: 1,
          updatedRange: 'PriceList!A2:P2',
          updatedData: { values: body.values },
        },
      })
    }
    throw new Error(`Unexpected append request: ${call.init?.method} ${path}`)
  },
  async (calls) => {
    const result = await createRepository().append({
      id: 'z9y8x7w6',
      item_code: 'ITM-0013',
      category: 'bottoms',
      subcategory: 'trousers',
      itemtype: 'wash',
      display_name_th: 'กางเกง',
      service_type: 'WASH',
      price_group: 'DEFAULT',
      price: 90,
      credit_eligible: false,
      effective_from: '2026-02-03',
      active: true,
    })

    const appendCall = calls.find((call) => apiPath(call.url).endsWith('/values/PriceList!A:A:append'))
    assert.ok(appendCall)
    assert.equal(new URL(appendCall.url).searchParams.get('valueInputOption'), 'USER_ENTERED')
    assert.equal(result.id, 'z9y8x7w6')
    assert.equal(result.item_code, 'ITM-0013')
  },
)

await withMockSheets(
  async (call) => {
    const path = apiPath(call.url)
    if (call.init?.method === 'GET' && path.endsWith('/values/PriceList!1:1')) {
      return jsonResponse({ values: [headers] })
    }
    if (call.init?.method === 'GET' && path.endsWith('/values/PriceList!A:A')) {
      return jsonResponse({ values: [['id'], ['a1b2c3d4']] })
    }
    if (call.init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
      const body = requestBody(call)
      assert.deepEqual(body, {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'PriceList!N2:N2', values: [['2026-04-05']] },
          { range: 'PriceList!O2:O2', values: [['']] },
          { range: 'PriceList!P2:P2', values: [[false]] },
        ],
      })
      return jsonResponse({ responses: [{}, {}, {}] })
    }
    if (call.init?.method === 'GET' && path.endsWith('/values/PriceList!A2:P2')) {
      return jsonResponse({ values: [[...existingRow.slice(0, 13), '2026-04-05', '', false]] })
    }
    throw new Error(`Unexpected update request: ${call.init?.method} ${path}`)
  },
  async (calls) => {
    const result = await createRepository().update('a1b2c3d4', {
      effective_from: '2026-04-05',
      effective_to: null,
      active: false,
    })

    assert.deepEqual(result, {
      ...Object.fromEntries(headers.map((header, index) => [header, existingRow[index]])),
      effective_from: '2026-04-05',
      effective_to: '',
      active: false,
    })
    assert.equal(calls.filter((call) => call.init?.method === 'POST').length, 1)
  },
)

await assert.rejects(
  () => createRepository().delete('a1b2c3d4', 'staff'),
  /delete is not supported by sheet 'PriceList'/,
)

console.log('price-list Sheets API dry test passed')
