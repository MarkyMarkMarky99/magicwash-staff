import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'

/**
 * Layer 1 — API boundary workflow
 * (docs/invoice-module-refactor-plan.md's Workflow Test Plan).
 *
 * Exercises `invoiceRoutes` (the actual Vercel-facing routes built by
 * `invoice.module.ts`) end to end: sends the public camelCase create
 * payload and asserts the HTTP status plus the exact top-level response
 * body for every existing outcome, and that invalid input / extra fields /
 * client-supplied system fields cause no external write at all. All six
 * POST outcomes and their status codes are unchanged from before this
 * rollout.
 */

process.env.APPSCRIPT_URL = 'https://script.example/exec'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'
process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL = 'https://script.example/invoice-view-sync'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'invoice-api-workflow@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { invoiceRoutes } = await import('../../../../server/modules/invoices/invoice.module.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function response(input: { json?: unknown; ok?: boolean; status?: number }): Response {
  return {
    ok: input.ok ?? true,
    status: input.status ?? (input.ok === false ? 502 : 200),
    statusText: 'OK',
    json: async () => input.json,
  } as Response
}

const orderFormHeaders = [
  'id', 'order_number', 'customer_id', 'received_date', 'due_date',
  'service_type', 'status', 'quantity', 'hangers', 'bags', 'hangers_image',
  'bags_image', 'form_image', 'note', 'timestamp', 'created_by', 'updated_at',
  'updated_by', 'invoice_id', 'order_name', 'order_description',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type MockHandler = (body: Record<string, unknown>) => Promise<Response>
let activeHandler: MockHandler | undefined

function dispatchToActiveHandler(body: Record<string, unknown>): Promise<Response> {
  if (activeHandler === undefined) {
    throw new Error('No invoice workflow fetch handler is active')
  }
  return activeHandler(body)
}

async function withMockFetch<T>(
  handler: MockHandler,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const previousHandler = activeHandler
  activeHandler = handler
  globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
    const stringUrl = String(url)
    if (stringUrl === 'https://oauth2.googleapis.com/token') {
      return response({ json: { access_token: 'test-access-token', expires_in: 3600 } })
    }
    if (stringUrl === process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL) {
      return response({ json: { ok: true } })
    }
    if (stringUrl === process.env.APPSCRIPT_URL) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return dispatchToActiveHandler(body)
    }

    const parsedUrl = new URL(stringUrl)
    assert.equal(parsedUrl.origin, 'https://sheets.googleapis.com')
    const path = decodeURIComponent(parsedUrl.pathname)

    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!1:1')) {
      return response({ json: { values: [orderFormHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!A:A')) {
      return response({ json: { values: [['id'], ['ORD-0001']] } })
    }
    if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      const configuredResponse = await dispatchToActiveHandler({ ...body, target: 'OrderForm' })
      const configuredBody = await configuredResponse.json() as unknown
      if (isRecord(configuredBody) && configuredBody.status === 'error') {
        return response({ json: configuredBody, ok: false, status: 404 })
      }

      const data = body.data
      assert.ok(Array.isArray(data))
      return response({
        json: {
          spreadsheetId: 'orders-spreadsheet-id',
          responses: data.map(() => ({})),
        },
      })
    }
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!A2:U2')) {
      return response({ json: { values: [['ORD-0001', ...Array(20).fill(null)]] } })
    }

    throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
  }) as typeof fetch
  try {
    return await run()
  } finally {
    activeHandler = previousHandler
    globalThis.fetch = originalFetch
  }
}

function postRequest(body: unknown): ApiHandlerRequest {
  return { method: 'POST', query: {}, body, headers: {}, params: {} }
}

function validPayload(): Record<string, unknown> {
  return {
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    issuedDate: '2026-07-29',
    dueDate: '2026-08-12',
    customer: { customerCode: 'CUS-0001', customerName: 'Somchai' },
    adjustments: [],
    items: [{ description: 'Wash and fold', quantity: 2, unitPrice: 100, adjustments: [] }],
  }
}

const okAppend = async () => response({ json: { status: 'ok', target: 'x', data: { a: 1 } } })
const okBatchAppend = async (body: Record<string, unknown>) =>
  response({
    json: {
      status: 'ok',
      target: 'InvoiceItem',
      data: (body.data as unknown[]).map(() => ({ invoice_item_id: 'aaaaaaaa' })),
    },
  })

test('POST returns 422 and calls no external write for invalid input', async () => {
  let fetchCalled = false
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    fetchCalled = true
    return response({ json: {} })
  }) as typeof fetch

  try {
    const result = await invoiceRoutes.collection.handleRequest(postRequest({ invoiceNumber: '' }))
    assert.equal(result.status, 422)
    assert.equal((result.body as { kind: string }).kind, 'validation_error')
    assert.equal(fetchCalled, false, 'no external write for invalid input')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('POST returns 422 for extra/unknown fields — the request schema is .strict()', async () => {
  const result = await invoiceRoutes.collection.handleRequest(
    postRequest({ ...validPayload(), unknownField: 'nope' }),
  )
  assert.equal(result.status, 422)
  assert.equal((result.body as { kind: string }).kind, 'validation_error')
})

test('POST returns 422 when the client sends a system-owned field (status) instead of letting the server set it', async () => {
  const result = await invoiceRoutes.collection.handleRequest(
    postRequest({ ...validPayload(), status: 'ISSUED' }),
  )
  assert.equal(result.status, 422)
})

test('POST returns 201 "created" with the server-computed totals on success', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') return okBatchAppend(body)
      return okAppend()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 201)
      assert.deepEqual(result.body, {
        kind: 'created',
        invoiceNumber: 'INV-0001',
        itemCount: 1,
        itemsTotal: 200,
        invoiceTotal: 200,
      })
    },
  )
})

test('POST returns 502 items_write_failed with certainty "rejected" when the gateway explicitly rejects the batch — safe to retry', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') {
        return response({ json: { status: 'error', message: 'validation failed at data[0]' } })
      }
      return okAppend()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 502)
      const body = result.body as { kind: string; certainty: string }
      assert.equal(body.kind, 'items_write_failed')
      assert.equal(body.certainty, 'rejected')
    },
  )
})

// Renamed from a prior version of this test that (incorrectly) named this
// case "rejected — safe to retry" while driving it with an HTTP-level
// failure — which this codebase's own SheetLibTransportError classifies as
// 'unknown', not a definite rejection. An HTTP 502/non-2xx from the gateway
// itself is exactly the kind of platform failure most likely to have
// persisted the batch server-side despite the client never seeing a
// response — never safe to retry.
test('POST returns 502 items_write_failed with certainty "unknown" when the item batch call fails at the transport level — never safe to retry', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') {
        return response({ ok: false })
      }
      return okAppend()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 502)
      const body = result.body as { kind: string; certainty: string }
      assert.equal(body.kind, 'items_write_failed')
      assert.equal(body.certainty, 'unknown')
    },
  )
})

test('POST returns 500 invoice_write_failed when items succeed but the header write fails', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') return okBatchAppend(body)
      if (body.target === 'Invoice') return response({ json: { status: 'error', message: 'duplicate' } })
      return okAppend()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 500)
      assert.deepEqual(result.body, {
        kind: 'invoice_write_failed',
        invoiceNumber: 'INV-0001',
        itemCount: 1,
        certainty: 'rejected',
      })
    },
  )
})

test('POST returns 500 order_link_failed when items and header succeed but the OrderForm link fails', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') return okBatchAppend(body)
      if (body.target === 'Invoice') return okAppend()
      if (body.target === 'OrderForm') return response({ json: { status: 'error', message: 'not found' } })
      return okAppend()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 500)
      assert.deepEqual(result.body, {
        kind: 'order_link_failed',
        invoiceNumber: 'INV-0001',
        sourceOrderId: 'ORD-0001',
        certainty: 'rejected',
      })
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice API boundary workflow tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
