import assert from 'node:assert/strict'

interface CapturedResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  status(code: number): CapturedResponse
  setHeader(name: string, value: string): CapturedResponse
  json(body: unknown): CapturedResponse
  end(body?: unknown): CapturedResponse
  send(body: unknown): CapturedResponse
}

function createResponse(): CapturedResponse {
  const captured: CapturedResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      captured.statusCode = code
      return captured
    },
    setHeader(name, value) {
      captured.headers[name] = value
      return captured
    },
    json(body) {
      captured.body = body
      return captured
    },
    end(body) {
      captured.body = body
      return captured
    },
    send(body) {
      captured.body = body
      return captured
    },
  }
  return captured
}

function request(method: string, path: string): Record<string, unknown> {
  const pathSegments = path.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  return {
    method,
    url: path,
    originalUrl: path,
    query: { path: pathSegments },
    body: undefined,
    headers: {},
  }
}

function emptyGvizResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () =>
      `google.visualization.Query.setResponse(${JSON.stringify({
        status: 'ok',
        table: {
          cols: Array.from({ length: 14 }, (_, index) => ({
            id: String.fromCharCode(65 + index),
          })),
          rows: [],
        },
      })});`,
    json: async () => ({}),
  } as Response
}

async function gateway() {
  const module = await import('../../../../api/[...path].js')
  return module.default as unknown as (
    req: unknown,
    res: unknown,
  ) => Promise<unknown> | unknown
}

async function invoke(method: string, path: string): Promise<CapturedResponse> {
  const response = createResponse()
  await (await gateway())(request(method, path), response)
  return response
}

const previousPriceListSpreadsheetId = process.env.PRICE_LIST_SPREADSHEET_ID
delete process.env.PRICE_LIST_SPREADSHEET_ID

try {
  await assert.doesNotReject(async () => import('../../../../api/[...path].js'))
} finally {
  if (previousPriceListSpreadsheetId === undefined) {
    delete process.env.PRICE_LIST_SPREADSHEET_ID
  } else {
    process.env.PRICE_LIST_SPREADSHEET_ID = previousPriceListSpreadsheetId
  }
}

process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-test-spreadsheet'

const originalFetch = globalThis.fetch
let fetchCalls = 0
globalThis.fetch = (async () => {
  fetchCalls += 1
  return emptyGvizResponse()
}) as typeof fetch

try {
  const listResponse = await invoke('GET', '/api/price-list')
  assert.equal(listResponse.statusCode, 200)
  assert.deepEqual(listResponse.body, {
    success: true,
    data: [],
    meta: {
      pagination: {
        page: 1,
        perPage: 20,
      },
    },
  })

  const callsBeforeUnsupportedMethods = fetchCalls
  const postResponse = await invoke('POST', '/api/price-list')
  assert.equal(postResponse.statusCode, 405)
  assert.equal(postResponse.headers.Allow, 'GET')

  const itemResponse = await invoke('GET', '/api/price-list/price-001')
  assert.equal(itemResponse.statusCode, 404)
  assert.equal(fetchCalls, callsBeforeUnsupportedMethods)

  delete process.env.PRICE_LIST_SPREADSHEET_ID
  process.env.CUSTOMERS_SPREADSHEET_ID = 'customers-test-spreadsheet'
  const unrelatedRouteResponse = await invoke('GET', '/api/customers')
  assert.equal(unrelatedRouteResponse.statusCode, 200)
} finally {
  globalThis.fetch = originalFetch
  if (previousPriceListSpreadsheetId === undefined) {
    delete process.env.PRICE_LIST_SPREADSHEET_ID
  } else {
    process.env.PRICE_LIST_SPREADSHEET_ID = previousPriceListSpreadsheetId
  }
  delete process.env.CUSTOMERS_SPREADSHEET_ID
}

console.log('price-list gateway dry test passed')
