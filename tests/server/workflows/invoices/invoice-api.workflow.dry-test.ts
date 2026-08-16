import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import { invoiceItemsRowSchema } from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { invoicesRowSchema } from '../../../../server/sheets/Invoices/Invoices.db-contract.js'

/**
 * API boundary workflow.
 *
 * Exercises `invoiceRoutes` (the actual Vercel-facing routes built by
 * `invoice.module.ts`) end to end: sends the public camelCase create
 * payload and asserts the HTTP status plus the exact top-level response
 * body for every existing outcome, and that invalid input / extra fields /
 * client-supplied system fields cause no external write at all.
 */

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
  // SheetsApiClient reads failed responses via response.text() for the excerpt
  // that lands in WriteRejectedError / WriteTransportError messages.
  const bodyText = input.json === undefined ? '' : JSON.stringify(input.json)
  return {
    ok: input.ok ?? true,
    status: input.status ?? (input.ok === false ? 502 : 200),
    statusText: 'OK',
    json: async () => input.json,
    text: async () => bodyText,
  } as Response
}

const invoiceItemsHeaders = Object.keys(invoiceItemsRowSchema.shape)
const invoicesHeaders = Object.keys(invoicesRowSchema.shape)

const orderFormHeaders = [
  'id', 'order_number', 'customer_id', 'received_date', 'due_date',
  'service_type', 'status', 'quantity', 'hangers', 'bags', 'hangers_image',
  'bags_image', 'form_image', 'note', 'timestamp', 'created_by', 'updated_at',
  'updated_by', 'invoice_id', 'order_name', 'order_description',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Logical write target used by per-test handlers to inject success/failure
 * without caring which transport owns the sheet. InvoiceItem / Invoice now
 * arrive from Sheets API appends; OrderForm still arrives from batchUpdate.
 */
type LogicalTarget = 'InvoiceItem' | 'Invoice' | 'OrderForm'

type MockHandler = (body: Record<string, unknown> & { target: LogicalTarget }) => Promise<Response>
let activeHandler: MockHandler | undefined

function dispatchToActiveHandler(
  body: Record<string, unknown> & { target: LogicalTarget },
): Promise<Response> {
  if (activeHandler === undefined) {
    throw new Error('No invoice workflow fetch handler is active')
  }
  return activeHandler(body)
}

function appendOk(spreadsheetId: string, values: unknown[][]): Response {
  return response({
    json: {
      spreadsheetId,
      updates: {
        updatedRows: values.length,
        updatedData: { values },
      },
    },
  })
}

/**
 * Map a handler's logical response onto a real Sheets API HTTP result.
 * status:'error' → HTTP 400 WriteRejectedError (certainty rejected).
 * ok:false       → HTTP 502 WriteTransportError (certainty unknown).
 */
async function resolveWriteResponse(
  configured: Response,
  onSuccess: () => Response,
): Promise<Response> {
  if (configured.ok === false) {
    return response({ ok: false, status: configured.status || 502, json: await configured.json().catch(() => ({})) })
  }
  const configuredBody = await configured.json() as unknown
  if (isRecord(configuredBody) && configuredBody.status === 'error') {
    return response({ json: configuredBody, ok: false, status: 400 })
  }
  return onSuccess()
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

    const parsedUrl = new URL(stringUrl)
    assert.equal(parsedUrl.origin, 'https://sheets.googleapis.com')
    const path = decodeURIComponent(parsedUrl.pathname)
    const body = init?.body === undefined
      ? {}
      : JSON.parse(String(init.body)) as Record<string, unknown>

    // InvoiceItems / Invoices headers — always succeed so failure cases can
    // target the append itself.
    if (init?.method === 'GET' && path.endsWith('/values/InvoiceItems!1:1')) {
      return response({ json: { values: [invoiceItemsHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/Invoices!1:1')) {
      return response({ json: { values: [invoicesHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/InvoiceItems!B:B')) {
      return response({ json: { values: [['invoice_item_id']] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/Invoices!A:A')) {
      return response({ json: { values: [['invoice_number']] } })
    }

    if (init?.method === 'POST' && path.endsWith('/values/InvoiceItems:append')) {
      const values = body.values as unknown[][]
      const configured = await dispatchToActiveHandler({ ...body, target: 'InvoiceItem' })
      return resolveWriteResponse(configured, () => appendOk('invoices-spreadsheet-id', values))
    }

    if (init?.method === 'POST' && path.endsWith('/values/Invoices:append')) {
      const values = body.values as unknown[][]
      const configured = await dispatchToActiveHandler({ ...body, target: 'Invoice' })
      return resolveWriteResponse(configured, () => appendOk('invoices-spreadsheet-id', values))
    }

    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!1:1')) {
      return response({ json: { values: [orderFormHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!A:A')) {
      return response({ json: { values: [['id'], ['ORD-0001']] } })
    }
    if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
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

const okWrite = async () => response({ json: { status: 'ok' } })

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
    async () => okWrite(),
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
      return okWrite()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 502)
      // Full body: items_write_failed is the only retry-gated outcome; message is
      // required by createInvoiceItemsFailedSchema and must stay non-empty.
      assert.deepEqual(result.body, {
        kind: 'items_write_failed',
        message:
          'The Sheets API rejected appendRows with HTTP 400. Response body: {"status":"error","message":"validation failed at data[0]"}',
        certainty: 'rejected',
      })
    },
  )
})

// An HTTP 502/non-2xx from the gateway is a transport-level failure with no
// definite rejection: the batch may already have persisted server-side
// despite the client never seeing a response — certainty is 'unknown', never
// safe to retry.
test('POST returns 502 items_write_failed with certainty "unknown" when the item batch call fails at the transport level — never safe to retry', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'InvoiceItem') {
        return response({ ok: false })
      }
      return okWrite()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 502)
      assert.deepEqual(result.body, {
        kind: 'items_write_failed',
        message:
          'Write outcome unknown: appendRows received no authoritative result from the Sheets API. Response body: ',
        certainty: 'unknown',
      })
    },
  )
})

test('POST returns 500 invoice_write_failed with certainty "rejected" when items succeed but the header write is refused', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'Invoice') return response({ json: { status: 'error', message: 'duplicate' } })
      return okWrite()
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

test('POST returns 500 invoice_write_failed with certainty "unknown" when the header append fails at the transport level', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'Invoice') return response({ ok: false })
      return okWrite()
    },
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(postRequest(validPayload()))
      assert.equal(result.status, 500)
      // No message field on this outcome — full body is kind + invoiceNumber + itemCount + certainty.
      assert.deepEqual(result.body, {
        kind: 'invoice_write_failed',
        invoiceNumber: 'INV-0001',
        itemCount: 1,
        certainty: 'unknown',
      })
    },
  )
})

test('POST returns 500 order_link_failed when items and header succeed but the OrderForm link fails', async () => {
  await withMockFetch(
    async (body) => {
      if (body.target === 'OrderForm') return response({ json: { status: 'error', message: 'not found' } })
      return okWrite()
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
