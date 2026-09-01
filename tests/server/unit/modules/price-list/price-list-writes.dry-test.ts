import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-module-test-spreadsheet'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(
  JSON.stringify({
    client_email: 'price-list-module-test@example.test',
    private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
  }),
).toString('base64')

const { priceListRoutes } = await import(
  '../../../../../server/modules/price-list/price-list.module.js'
)

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function gvizResponse(rows: SheetRow[]): Response {
  const columns = SHEET_HEADERS.map((_header, index) => ({
    id: String.fromCharCode(65 + index),
  }))
  const tableRows = rows.map((row) => ({
    c: row.map((value, index) => {
      if (value === null) return null
      const dateValue = index === 11 || index === 12 ? asGvizDate(value) : value
      return { v: dateValue }
    }),
  }))

  return new Response(
    `google.visualization.Query.setResponse(${JSON.stringify({
      status: 'ok',
      table: { cols: columns, rows: tableRows },
    })});`,
    { status: 200, headers: { 'Content-Type': 'text/plain' } },
  )
}

function asGvizDate(value: unknown): unknown {
  if (typeof value !== 'string' || value.startsWith('Date(')) return value
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return value
  return `Date(${match[1]},${Number(match[2]) - 1},${match[3]})`
}

function apiPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname)
}

function columnNumber(column: string): number {
  return column.split('').reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0,
  )
}

function rowsForGviz(url: string): SheetRow[] {
  const query = new URL(url).searchParams.get('tq') ?? ''
  const idMatch = /A\s*=\s*'([^']+)'/.exec(query)
  return idMatch === null ? sheetRows : sheetRows.filter((row) => row[0] === idMatch[1])
}

function applyUpdate(body: Record<string, unknown>): void {
  assert.ok(Array.isArray(body.data))
  for (const entry of body.data) {
    assert.ok(typeof entry === 'object' && entry !== null)
    const update = entry as { range?: string; values?: unknown[][] }
    assert.equal(typeof update.range, 'string')
    assert.ok(Array.isArray(update.values))

    const match = /PriceList!([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(update.range!)
    assert.ok(match)
    const rowIndex = Number(match[2]) - 2
    const columnIndex = columnNumber(match[1]!) - 1
    for (const [rowOffset, values] of update.values!.entries()) {
      const row = sheetRows[rowIndex + rowOffset]
      assert.ok(row)
      for (const [columnOffset, value] of values.entries()) {
        row[columnIndex + columnOffset] = value
      }
    }
  }
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

function dataOf(result: { status: number; body: unknown }): Record<string, unknown> {
  assert.equal(result.status === 200 || result.status === 201, true)
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
  displayNameTh: 'กางเกง',
  creditEligible: false,
  effectiveFrom: '2026-02-03',
  active: true,
}

let failWrites = false

async function withMockSheets(run: (calls: FetchCall[]) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)

    if (call.url === 'https://oauth2.googleapis.com/token') {
      return jsonResponse({ access_token: 'price-list-test-access-token', expires_in: 3600 })
    }
    if (call.url.includes('/gviz/tq')) {
      return gvizResponse(rowsForGviz(call.url))
    }

    const path = apiPath(call.url)
    if (init?.method === 'GET' && path.endsWith('/values/PriceList!1:1')) {
      return jsonResponse({ values: [SHEET_HEADERS] })
    }
    if (init?.method === 'GET' && path.endsWith('/values/PriceList!A:A')) {
      return jsonResponse({ values: [['id'], ...sheetRows.map((row) => [row[0]])] })
    }
    if (failWrites && init?.method === 'POST') {
      return jsonResponse({ error: 'write rejected by fake Sheets API' }, 503)
    }
    if (init?.method === 'POST' && path.endsWith('/values/PriceList:append')) {
      const body = JSON.parse(String(init.body)) as { values?: SheetRow[] }
      assert.ok(Array.isArray(body.values))
      assert.equal(body.values.length, 1)
      sheetRows.push([...body.values[0]!])
      return jsonResponse({
        spreadsheetId: process.env.PRICE_LIST_SPREADSHEET_ID,
        updates: { updatedRows: 1, updatedRange: 'PriceList!A2:N2', updatedData: { values: body.values } },
      })
    }
    if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      applyUpdate(body)
      return jsonResponse({
        spreadsheetId: process.env.PRICE_LIST_SPREADSHEET_ID,
        responses: Array.isArray(body.data) ? body.data.map(() => ({})) : [],
      })
    }
    if (init?.method === 'GET' && /\/values\/PriceList!A\d+:N\d+$/.test(path)) {
      const rowNumber = Number(/PriceList!A(\d+):N\d+$/.exec(path)![1]) - 2
      return jsonResponse({ values: [sheetRows[rowNumber]] })
    }

    throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
  }) as typeof fetch

  try {
    await run(calls)
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

  for (const body of [
    { active: false, id: 'changed-id' },
    { active: false, itemCode: 'ITM-9999' },
  ]) {
    const before = calls.length
    assertApiError(
      await priceListRoutes.item!.handleRequest(request('PATCH', body, { id: 'a1b2c3d4' })),
      422,
      'VALIDATION_ERROR',
    )
    assert.equal(calls.length, before)
  }

  const firstCreate = await priceListRoutes.collection.handleRequest(
    request('POST', createPayload),
  )
  assert.equal(firstCreate.status, 201)
  const firstCreated = dataOf(firstCreate)
  assert.match(String(firstCreated.id), /^[a-z0-9]{8}$/)
  assert.equal(firstCreated.itemCode, 'ITM-0013')
  assert.equal(firstCreated.variant, null)
  assert.equal(firstCreated.washDryIronPrice, null)
  assert.equal(firstCreated.effectiveFrom, '2026-02-03')
  assert.equal(firstCreated.effectiveTo, null)
  assert.equal(JSON.stringify(firstCreate.body).includes('Date('), false)

  const appendCall = calls.find(
    (call) => call.init?.method === 'POST' && apiPath(call.url).endsWith('/values/PriceList:append'),
  )
  assert.ok(appendCall)
  const appendUrl = new URL(appendCall.url)
  assert.equal(appendUrl.searchParams.get('valueInputOption'), 'USER_ENTERED')
  const appendBody = JSON.parse(String(appendCall.init?.body)) as { values: SheetRow[] }
  assert.equal(appendBody.values[0]![11], '2026-02-03')

  const secondCreate = await priceListRoutes.collection.handleRequest(
    request('POST', { ...createPayload, displayNameTh: 'กางเกงตัวที่สอง' }),
  )
  assert.equal(secondCreate.status, 201)
  const secondCreated = dataOf(secondCreate)
  assert.match(String(secondCreated.id), /^[a-z0-9]{8}$/)
  assert.notEqual(secondCreated.id, firstCreated.id)
  assert.equal(secondCreated.itemCode, 'ITM-0014')

  const listAfterCreates = await priceListRoutes.collection.handleRequest(request('GET'))
  const listedAfterCreates = bodyOf(listAfterCreates).data as Array<Record<string, unknown>>
  assert.deepEqual(
    listedAfterCreates.find((item) => item.id === firstCreated.id),
    firstCreated,
  )
  assert.deepEqual(
    listedAfterCreates.find((item) => item.id === secondCreated.id),
    secondCreated,
  )

  const beforeUpdate = listedAfterCreates.find((item) => item.id === 'a1b2c3d4')
  assert.ok(beforeUpdate)
  const updatedResponse = await priceListRoutes.item!.handleRequest(
    request('PATCH', { washDryIronPrice: 95, active: false }, { id: 'a1b2c3d4' }),
  )
  assert.equal(updatedResponse.status, 200)
  const updated = dataOf(updatedResponse)
  assert.deepEqual(updated, { ...beforeUpdate, washDryIronPrice: 95, active: false })

  const listAfterUpdate = await priceListRoutes.collection.handleRequest(request('GET'))
  const afterUpdate = (bodyOf(listAfterUpdate).data as Array<Record<string, unknown>>).find(
    (item) => item.id === 'a1b2c3d4',
  )
  assert.deepEqual(afterUpdate, updated)

  const beforeMissingUpdate = calls.length
  const beforeMissingUpdateWritePosts = calls.filter(
    (call) => call.init?.method === 'POST' && call.url.includes('sheets.googleapis.com'),
  ).length
  assertApiError(
    await priceListRoutes.item!.handleRequest(
      request('PATCH', { active: false }, { id: 'ffffffff' }),
    ),
    404,
    'NOT_FOUND',
  )
  assert.equal(calls.length > beforeMissingUpdate, true)
  assert.equal(
    calls.filter((call) => call.init?.method === 'POST' && call.url.includes('sheets.googleapis.com'))
      .length,
    beforeMissingUpdateWritePosts,
  )

  const beforeMissingPathId = calls.length
  assertApiError(
    await priceListRoutes.item!.handleRequest(request('PATCH', { active: false }, {})),
    404,
    'NOT_FOUND',
  )
  assert.equal(calls.length, beforeMissingPathId)

  const collectionDelete = await priceListRoutes.collection.handleRequest(request('DELETE'))
  assert.equal(collectionDelete.status, 405)
  assert.equal(collectionDelete.headers?.Allow, 'GET, POST')
  const itemDelete = await priceListRoutes.item!.handleRequest(
    request('DELETE', undefined, { id: 'a1b2c3d4' }),
  )
  assert.equal(itemDelete.status, 405)
  assert.equal(itemDelete.headers?.Allow, 'PATCH')
})

failWrites = true
const loggedErrors: unknown[][] = []
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  loggedErrors.push(args)
}
try {
  await withMockSheets(async () => {
    const failedCreate = await priceListRoutes.collection.handleRequest(
      request('POST', createPayload),
    )
    assertApiError(failedCreate, 500, 'INTERNAL_ERROR')
  })
} finally {
  console.error = originalConsoleError
}
assert.equal(loggedErrors.length, 1)
assert.match(String(loggedErrors[0]![0]), /Unhandled error in API controller/)

console.log('price-list write workflow dry test passed')
