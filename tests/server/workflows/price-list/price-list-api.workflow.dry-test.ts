import assert from 'node:assert/strict'

interface CapturedResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  status(code: number): CapturedResponse
  setHeader(name: string, value: string): CapturedResponse
  json(body: unknown): CapturedResponse
  end(body?: unknown): CapturedResponse
}

interface RequestOptions {
  method?: string
  query?: Record<string, string>
  path?: string
}

interface FetchCall {
  url: string
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
  }
  return captured
}

function request(options: RequestOptions = {}): Record<string, unknown> {
  const method = options.method ?? 'GET'
  const path = options.path ?? '/api/price-list'
  const query = options.query ?? {}
  const search = new URLSearchParams(query).toString()
  const url = search === '' ? path : `${path}?${search}`

  return {
    method,
    url,
    originalUrl: url,
    query,
    body: undefined,
    headers: {},
  }
}

function gvizBody(rows: unknown[] = []): string {
  const columns = Array.from({ length: 14 }, (_, index) => ({
    id: String.fromCharCode(65 + index),
  }))

  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: columns,
      rows: rows.map((values) => ({
        c: (values as unknown[]).map((value) =>
          value === null ? null : { v: value },
        ),
      })),
    },
  })});`
}

function gvizResponse(text: string, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    statusText: ok ? 'OK' : 'Service Unavailable',
    text: async () => text,
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

async function invoke(options: RequestOptions = {}): Promise<CapturedResponse> {
  const response = createResponse()
  await (await gateway())(request(options), response)
  return response
}

async function withMockFetch<T>(
  handler: (url: string) => Promise<Response>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string) => {
    const call = { url: String(url) }
    calls.push(call)
    return handler(call.url)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

const representativeRow = [
  'ab12cd34',
  'ITM-0001',
  'tops',
  'shirt',
  'wash',
  null,
  'เสื้อเชิ้ต',
  0,
  null,
  120,
  false,
  'Date(2026,0,1)',
  null,
  false,
]

const expectedItem = {
  id: 'ab12cd34',
  itemCode: 'ITM-0001',
  category: 'tops',
  subcategory: 'shirt',
  itemType: 'wash',
  variant: null,
  displayNameTh: 'เสื้อเชิ้ต',
  washDryIronPrice: 0,
  ironOnlyPrice: null,
  dryCleanPrice: 120,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: false,
}

const previousSpreadsheetId = process.env.PRICE_LIST_SPREADSHEET_ID
delete process.env.PRICE_LIST_SPREADSHEET_ID

try {
  const missingEnvironmentResponse = await invoke()
  assert.equal(missingEnvironmentResponse.statusCode, 500)
  const body = missingEnvironmentResponse.body as {
    success: boolean
    error: { code: string; message: string; details?: unknown }
    meta: { timestamp: string }
  }
  assert.equal(body.success, false)
  assert.deepEqual(body.error, {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    details: undefined,
  })
  assert.equal(typeof body.meta.timestamp, 'string')
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.PRICE_LIST_SPREADSHEET_ID
  } else {
    process.env.PRICE_LIST_SPREADSHEET_ID = previousSpreadsheetId
  }
}

process.env.PRICE_LIST_SPREADSHEET_ID = 'price-list-test-spreadsheet'

try {
  await withMockFetch(
    async () => gvizResponse(gvizBody([representativeRow])),
    async (calls) => {
      const response = await invoke()
      assert.equal(response.statusCode, 200)
      const body = response.body as {
        success: boolean
        data: unknown[]
        meta: { pagination: Record<string, unknown>; timestamp: string }
      }

      assert.equal(body.success, true)
      assert.deepEqual(body.data, [expectedItem])
      assert.equal(JSON.stringify(body).includes('Date('), false)
      assert.deepEqual(Object.keys(body), ['success', 'data', 'meta'])
      assert.deepEqual(Object.keys(body.meta).sort(), ['pagination', 'timestamp'])
      assert.deepEqual(body.meta.pagination, { page: 1, perPage: 20 })
      assert.equal('total' in body.meta.pagination, false)
      assert.equal('totalPages' in body.meta.pagination, false)
      assert.equal(typeof body.meta.timestamp, 'string')
      assert.deepEqual(Object.keys(body.data[0] as object), Object.keys(expectedItem))
      assert.equal(calls.length, 1)

      const query = new URL(calls[0]!.url).searchParams.get('tq')
      assert.equal(query, 'select *\norder by B asc\nlimit 20\noffset 0')
    },
  )

  await withMockFetch(
    async () => gvizResponse(gvizBody()),
    async (calls) => {
      const response = await invoke({
        query: {
          keyword: 'shirt',
          itemCode: 'ITM-0001',
          category: 'tops',
          subcategory: 'shirt',
          itemType: 'wash',
          active: 'true',
          page: '2',
          perPage: '5',
          sortBy: 'displayNameTh',
          sortOrder: 'desc',
        },
      })

      assert.equal(response.statusCode, 200)
      assert.equal(calls.length, 1)
      const query = new URL(calls[0]!.url).searchParams.get('tq') ?? ''
      assert.match(query, /B contains 'shirt'/)
      assert.match(query, /C contains 'shirt'/)
      assert.match(query, /D contains 'shirt'/)
      assert.match(query, /E contains 'shirt'/)
      assert.match(query, /F contains 'shirt'/)
      assert.match(query, /G contains 'shirt'/)
      assert.match(query, /B = 'ITM-0001'/)
      assert.match(query, /C = 'tops'/)
      assert.match(query, /D = 'shirt'/)
      assert.match(query, /E = 'wash'/)
      assert.match(query, /order by G desc/)
      assert.match(query, /limit 5\noffset 5/)
      assert.equal(query.includes('active'), false)
      assert.equal(query.includes('itemCode'), false)
      assert.equal(query.includes('itemType'), false)
      assert.equal(query.includes('displayNameTh'), false)
    },
  )

  await withMockFetch(
    async () =>
      gvizResponse(
        gvizBody([
          [
            'legacy-row',
            'LEGACY-001',
            'legacy-category',
            '',
            'legacy-itemtype',
            '',
            'Legacy display name',
            '0',
            'legacy-price',
            0,
            'false',
            'Date(2025,11,31)',
            'Date(2026,11,31)',
            false,
          ],
        ]),
      ),
    async () => {
      const response = await invoke({ query: { perPage: '1' } })
      assert.equal(response.statusCode, 200)
      assert.equal((response.body as { success: boolean }).success, true)
      assert.equal(JSON.stringify(response.body).includes('Date('), false)
      assert.deepEqual((response.body as { data: unknown[] }).data, [
        {
          id: 'legacy-row',
          itemCode: 'LEGACY-001',
          category: 'legacy-category',
          subcategory: '',
          itemType: 'legacy-itemtype',
          variant: '',
          displayNameTh: 'Legacy display name',
          washDryIronPrice: '0',
          ironOnlyPrice: 'legacy-price',
          dryCleanPrice: 0,
          creditEligible: 'false',
          effectiveFrom: '2025-12-31',
          effectiveTo: '2026-12-31',
          active: false,
        },
      ])
      assert.equal(
        Object.keys((response.body as { data: Array<Record<string, unknown>> }).data[0]!).some(
          (key) => key.includes('_'),
        ),
        false,
      )
    },
  )

  await withMockFetch(
    async () => gvizResponse('', false),
    async () => {
      const response = await invoke()
      assert.equal(response.statusCode, 500)
      assert.equal((response.body as { success: boolean }).success, false)
      assert.equal(
        (response.body as { error: { code: string } }).error.code,
        'INTERNAL_ERROR',
      )
    },
  )

  const collectionDeleteResponse = await invoke({ method: 'DELETE' })
  assert.equal(collectionDeleteResponse.statusCode, 405)
  assert.equal(collectionDeleteResponse.headers.Allow, 'GET, POST')

  const itemDeleteResponse = await invoke({
    method: 'DELETE',
    path: '/api/price-list/ab12cd34',
  })
  assert.equal(itemDeleteResponse.statusCode, 405)
  assert.equal(itemDeleteResponse.headers.Allow, 'PATCH')
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.PRICE_LIST_SPREADSHEET_ID
  } else {
    process.env.PRICE_LIST_SPREADSHEET_ID = previousSpreadsheetId
  }
}

console.log('price-list API workflow dry test passed')
