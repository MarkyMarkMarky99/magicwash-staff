import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'

process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-write-workflow-spreadsheet'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'price-list-api-workflow@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { priceListRoutes } = await import('../../../../server/modules/price-list/price-list.module.js')

type SheetRow = unknown[]

const SHEET_HEADERS = [
  'id',
  'item_code',
  'category',
  'subcategory',
  'itemtype',
  'variant',
  'display_name_th',
  'wash_dry_iron_price',
  'iron_only_price',
  'dry_clean_price',
  'credit_eligible',
  'effective_from',
  'effective_to',
  'active',
]

const sheetRows: SheetRow[] = [
  [
    'a1b2c3d4',
    'ITM-0012',
    'tops',
    'shirt',
    'wash',
    'standard',
    'เสื้อเชิ้ต',
    75,
    40,
    null,
    true,
    'Date(2026,0,1)',
    null,
    true,
  ],
]

interface FetchCall {
  url: string
  init?: RequestInit
}

interface MockState {
  failWrite: boolean
}

function response(input: { json?: unknown; ok?: boolean; status?: number }): Response {
  const bodyText = input.json === undefined ? '' : JSON.stringify(input.json)
  return {
    ok: input.ok ?? true,
    status: input.status ?? (input.ok === false ? 503 : 200),
    statusText: 'OK',
    json: async () => input.json,
    text: async () => bodyText,
  } as Response
}

function gvizBody(rows: SheetRow[]): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: SHEET_HEADERS.map((id) => ({ id })),
      rows: rows.map((row) => ({
        c: row.map((value, index) => ({
          v: index === 11 || index === 12 ? asGvizDate(value) : value,
        })),
      })),
    },
  })});`
}

function asGvizDate(value: unknown): unknown {
  if (value === null || typeof value !== 'string') return value
  if (value.startsWith('Date(')) return value
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `Date(${match[1]},${Number(match[2]) - 1},${match[3]})`
}

function columnNumber(column: string): number {
  return column.split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
}

function applyBatchUpdate(body: Record<string, unknown>): void {
  const data = body.data
  assert.ok(Array.isArray(data))

  for (const entry of data) {
    assert.ok(typeof entry === 'object' && entry !== null)
    const update = entry as { range?: string; values?: unknown[][] }
    assert.equal(typeof update.range, 'string')
    assert.ok(Array.isArray(update.values))
    const match = /PriceList!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/.exec(update.range as string)
    assert.ok(match)
    const startColumn = columnNumber(match[1]!) - 1
    const startRow = Number(match[2]) - 2
    for (const [rowOffset, values] of update.values!.entries()) {
      const target = sheetRows[startRow + rowOffset]
      assert.ok(target)
      for (const [columnOffset, value] of values.entries()) {
        target[startColumn + columnOffset] = value
      }
    }
  }
}

function filteredRows(url: string): SheetRow[] {
  const query = new URL(url).searchParams.get('tq') ?? ''
  const idMatch = /A\s*=\s*'([^']+)'/.exec(query)
  if (!idMatch) return sheetRows
  return sheetRows.filter((row) => row[0] === idMatch[1])
}

function request(
  method: string,
  body: unknown = undefined,
  params: Record<string, string> = {},
): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params }
}

function bodyOf(result: { body: unknown }): Record<string, unknown> {
  assert.ok(typeof result.body === 'object' && result.body !== null)
  return result.body as Record<string, unknown>
}

function dataOf(result: { body: unknown }): Record<string, unknown> {
  const body = bodyOf(result)
  assert.equal(body.success, true)
  assert.ok(typeof body.data === 'object' && body.data !== null)
  return body.data as Record<string, unknown>
}

function assertApiError(
  result: { status: number; body: unknown },
  status: number,
  code: string,
): void {
  assert.equal(result.status, status)
  const body = bodyOf(result)
  assert.equal(body.success, false)
  assert.ok(typeof body.error === 'object' && body.error !== null)
  assert.equal((body.error as { code: string }).code, code)
}

const createPayload = {
  category: 'bottoms',
  subcategory: 'trousers',
  itemType: 'wash',
  variant: null,
  displayNameTh: 'กางเกง',
  washDryIronPrice: 90,
  ironOnlyPrice: null,
  dryCleanPrice: 180,
  creditEligible: false,
  effectiveFrom: '2026-02-03',
  effectiveTo: null,
  active: true,
}

let activeState: MockState = { failWrite: false }

async function withMockSheets<T>(run: (calls: FetchCall[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input)
    const call = { url, init }
    calls.push(call)

    if (url === 'https://oauth2.googleapis.com/token') {
      return response({ json: { access_token: 'test-access-token', expires_in: 3600 } })
    }
    if (url.includes('/gviz/tq')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => gvizBody(filteredRows(url)),
        json: async () => ({}),
      } as Response
    }

    const parsedUrl = new URL(url)
    const path = decodeURIComponent(parsedUrl.pathname)
    if (init?.method === 'GET' && path.endsWith('/values/PriceList!1:1')) {
      return response({ json: { values: [SHEET_HEADERS] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/PriceList!A:A')) {
      return response({ json: { values: [SHEET_HEADERS.slice(0, 1), ...sheetRows.map((row) => [row[0]])] } })
    }
    if (activeState.failWrite && init?.method === 'POST') {
      return response({ ok: false, status: 503 })
    }
    if (init?.method === 'POST' && path.endsWith('/values/PriceList:append')) {
      const body = JSON.parse(String(init.body)) as { values?: SheetRow[] }
      assert.ok(Array.isArray(body.values))
      assert.equal(body.values.length, 1)
      sheetRows.push([...body.values[0]!])
      return response({
        json: {
          spreadsheetId: process.env.PRICE_LIST_SPREADSHEET_ID,
          updates: { updatedRows: 1, updatedData: { values: body.values } },
        },
      })
    }
    if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      applyBatchUpdate(body)
      return response({
        json: {
          spreadsheetId: process.env.PRICE_LIST_SPREADSHEET_ID,
          responses: Array.isArray(body.data) ? body.data.map(() => ({})) : [],
        },
      })
    }
    if (init?.method === 'GET' && /\/values\/PriceList!A\d+:N\d+$/.test(path)) {
      const rowNumber = Number(/PriceList!A(\d+):N\d+$/.exec(path)![1]) - 2
      return response({ json: { values: [sheetRows[rowNumber]] } })
    }

    throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withMockSheets(async (calls) => {
  const invalidCreateBodies = [
    { ...createPayload, id: 'client-id' },
    { ...createPayload, itemCode: 'ITM-9999' },
    (() => {
      const missing = { ...createPayload }
      delete (missing as Record<string, unknown>).category
      return missing
    })(),
    { ...createPayload, effectiveFrom: '03/02/2026' },
  ]

  for (const body of invalidCreateBodies) {
    const before = calls.length
    assertApiError(
      await priceListRoutes.collection.handleRequest(request('POST', body)),
      422,
      'VALIDATION_ERROR',
    )
    assert.equal(calls.length, before)
  }

  const invalidUpdateBodies = [
    { active: false, id: 'changed-id' },
    { active: false, itemCode: 'ITM-9999' },
  ]
  for (const body of invalidUpdateBodies) {
    const before = calls.length
    const result = await priceListRoutes.item!.handleRequest(
      request('PATCH', body, { id: 'a1b2c3d4' }),
    )
    assertApiError(result, 422, 'VALIDATION_ERROR')
    assert.equal(calls.length, before)
  }

  const firstCreate = await priceListRoutes.collection.handleRequest(
    request('POST', createPayload),
  )
  assert.equal(firstCreate.status, 201)
  const firstCreated = dataOf(firstCreate)
  assert.match(String(firstCreated.id), /^[a-z0-9]{8}$/)
  assert.notEqual(firstCreated.id, 'a1b2c3d4')
  assert.equal(firstCreated.itemCode, 'ITM-0013')
  assert.equal(firstCreated.effectiveFrom, '2026-02-03')
  assert.equal(firstCreated.effectiveTo, null)
  assert.equal(JSON.stringify(firstCreate.body).includes('Date('), false)

  const secondCreate = await priceListRoutes.collection.handleRequest(
    request('POST', { ...createPayload, displayNameTh: 'กางเกงตัวที่สอง' }),
  )
  assert.equal(secondCreate.status, 201)
  const secondCreated = dataOf(secondCreate)
  assert.match(String(secondCreated.id), /^[a-z0-9]{8}$/)
  assert.notEqual(secondCreated.id, firstCreated.id)
  assert.equal(secondCreated.itemCode, 'ITM-0014')

  const listAfterCreates = await priceListRoutes.collection.handleRequest(
    request('GET'),
  )
  const listedAfterCreates = bodyOf(listAfterCreates).data as Array<Record<string, unknown>>
  assert.deepEqual(
    listedAfterCreates.find((item) => item.id === firstCreated.id),
    {
      ...firstCreated,
    },
  )
  assert.deepEqual(
    listedAfterCreates.find((item) => item.id === secondCreated.id),
    {
      ...secondCreated,
    },
  )
  assert.equal(JSON.stringify(listAfterCreates.body).includes('Date('), false)

  const beforeUpdate = listedAfterCreates.find((item) => item.id === 'a1b2c3d4')
  assert.ok(beforeUpdate)
  const update = await priceListRoutes.item!.handleRequest(
    request('PATCH', { washDryIronPrice: 95, active: false }, { id: 'a1b2c3d4' }),
  )
  assert.equal(update.status, 200)
  const updated = dataOf(update)
  assert.equal(updated.washDryIronPrice, 95)
  assert.equal(updated.active, false)
  assert.equal(JSON.stringify(update.body).includes('Date('), false)

  const listAfterUpdate = await priceListRoutes.collection.handleRequest(request('GET'))
  const afterUpdate = (bodyOf(listAfterUpdate).data as Array<Record<string, unknown>>).find(
    (item) => item.id === 'a1b2c3d4',
  )
  assert.deepEqual(afterUpdate, {
    ...beforeUpdate,
    washDryIronPrice: 95,
    active: false,
  })

  const beforeMissingUpdate = calls.filter((call) => call.init?.method === 'POST').length
  const missingUpdate = await priceListRoutes.item!.handleRequest(
    request('PATCH', { active: false }, { id: 'ffffffff' }),
  )
  assertApiError(missingUpdate, 404, 'NOT_FOUND')
  assert.equal(
    calls.filter((call) => call.init?.method === 'POST').length,
    beforeMissingUpdate,
  )
})

activeState = { failWrite: true }
await withMockSheets(async () => {
  const failedCreate = await priceListRoutes.collection.handleRequest(
    request('POST', createPayload),
  )
  assertApiError(failedCreate, 500, 'INTERNAL_ERROR')
})

console.log('price-list API write workflow dry tests passed')
