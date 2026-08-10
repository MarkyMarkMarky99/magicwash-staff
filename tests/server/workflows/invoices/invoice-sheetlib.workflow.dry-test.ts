import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { CreateInvoiceRequest } from '../../../../contracts/invoices/invoice-api.schema.js'

/**
 * Mixed transport workflow.
 *
 * Exercises the REAL `InvoiceService` against a mocked `fetch`, asserting the
 * exact wire-level requests: one `InvoiceItem` APPEND and one `Invoice` APPEND
 * through SheetLib, plus an OrderForm keyed PATCH through the Sheets API with
 * only the invoice link fields.
 *
 * The repositories are the real, default-constructed ones — no fake repository
 * is injected, which is what makes the asserted request bodies meaningful. Only
 * the clock and the separate view-sync endpoint are stubbed (see the call site).
 */

process.env.APPSCRIPT_URL = 'https://script.example/exec'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'invoice-workflow@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { InvoiceService } = await import('../../../../server/modules/invoices/invoice.service.js')

const fixedNow = new Date('2026-04-01T00:34:56.000Z')

interface FetchCall {
  url: string
  body?: Record<string, unknown>
}

type FetchHandler = (body: Record<string, unknown>) => Promise<Response>

function response(input: { json?: unknown; ok?: boolean; statusText?: string }): Response {
  return {
    ok: input.ok ?? true,
    status: input.ok === false ? 502 : 200,
    statusText: input.statusText ?? 'OK',
    json: async () => input.json,
  } as Response
}

const orderFormHeaders = [
  'id', 'order_number', 'customer_id', 'received_date', 'due_date',
  'service_type', 'status', 'quantity', 'hangers', 'bags', 'hangers_image',
  'bags_image', 'form_image', 'note', 'timestamp', 'created_by', 'updated_at',
  'updated_by', 'invoice_id', 'order_name', 'order_description',
]

async function withRoutedFetch<T>(
  handlers: Record<string, FetchHandler>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
    const stringUrl = String(url)
    const parsedUrl = new URL(stringUrl)
    if (stringUrl === 'https://oauth2.googleapis.com/token') {
      return response({ json: { access_token: 'test-access-token', expires_in: 3600 } })
    }
    if (stringUrl === process.env.APPSCRIPT_URL) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      calls.push({ url: stringUrl, body })
      const target = body.target as string
      const handler = handlers[target]
      if (!handler) throw new Error(`No SheetLib handler configured for target ${target}`)
      return handler(body)
    }

    assert.equal(parsedUrl.origin, 'https://sheets.googleapis.com')
    const call: FetchCall = {
      url: stringUrl,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) as Record<string, unknown>,
    }
    calls.push(call)
    const path = decodeURIComponent(parsedUrl.pathname)
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!1:1')) {
      return response({ json: { values: [orderFormHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!A:A')) {
      return response({ json: { values: [['id'], ['ORD-0001']] } })
    }
    if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
      assert.equal(call.body?.valueInputOption, 'USER_ENTERED')
      assert.deepEqual(call.body?.data, [
        { range: 'OrderForm!S2:S2', values: [['INV-0001']] },
        { range: 'OrderForm!R2:R2', values: [['staff']] },
        { range: 'OrderForm!Q2:Q2', values: [['2026-04-01 07:34:56']] },
      ])
      return response({ json: { spreadsheetId: 'orders-spreadsheet-id', responses: [{}, {}, {}] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/OrderForm!A2:U2')) {
      return response({ json: { values: [['ORD-0001', ...Array(20).fill(null)]] } })
    }
    throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function baseRequest(): CreateInvoiceRequest {
  return {
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    issuedDate: '2026-07-29',
    dueDate: '2026-08-12',
    customer: { customerCode: 'CUS-0001', customerName: 'Somchai' },
    adjustments: [],
    items: [
      { description: 'Wash and fold', quantity: 10, unitPrice: 50, adjustments: [{ label: 'Line discount', calculation: 'FIXED', value: -10 }] },
      { description: 'Iron', quantity: 3, unitPrice: 20, adjustments: [] },
    ],
  }
}

async function main(): Promise<void> {
  const service = new InvoiceService({
    // The Apps Script view-sync integration is a separate URL/endpoint;
    // stub it so this test focuses on the three source-sheet writes.
    syncInvoiceView: async () => ({ outcome: 'confirmed' }),
    now: () => fixedNow,
  })

  await withRoutedFetch(
    {
      InvoiceItem: async (body) =>
        response({
          json: {
            status: 'ok',
            target: 'InvoiceItem',
            data: (body.data as unknown[]).map((_row, index) => ({ invoice_item_id: `item${index}` })),
          },
        }),
      Invoice: async () =>
        response({ json: { status: 'ok', target: 'Invoice', data: { invoice_number: 'INV-0001' } } }),
      OrderForm: async () =>
        response({ json: { status: 'ok', target: 'OrderForm', data: { id: 'ORD-0001', invoice_id: 'INV-0001' } } }),
    },
    async (calls) => {
      const result = await service.create(baseRequest())
      assert.equal(result.kind, 'created')

      assert.equal(calls.length, 6, 'two SheetLib writes plus four Sheets API OrderForm calls')
      assert.deepEqual(calls.slice(0, 2).map((call) => call.body?.target), ['InvoiceItem', 'Invoice'])
      assert.deepEqual(calls.slice(2).map((call) => new URL(call.url).origin), [
        'https://sheets.googleapis.com',
        'https://sheets.googleapis.com',
        'https://sheets.googleapis.com',
        'https://sheets.googleapis.com',
      ])

      // ── InvoiceItem: one APPEND, ordered data[] array, no loop ──
      const itemsCall = calls[0]
      const itemsBody = itemsCall.body!
      assert.equal(itemsBody.resource, 'sheet')
      assert.equal(itemsBody.action, 'APPEND')
      assert.ok(Array.isArray(itemsBody.data))
      const itemRows = itemsBody.data as Array<Record<string, unknown>>
      assert.equal(itemRows.length, 2)
      assert.deepEqual(itemRows.map((row) => row.item_no), [1, 2], 'array order must survive into the request')
      assert.deepEqual(itemRows.map((row) => row.invoice_number), ['INV-0001', 'INV-0001'])
      // net_total server-computed: FIXED -10 per unit × quantity 10 = 400, not 490.
      assert.equal(itemRows[0].net_total, 400)
      assert.equal(itemRows[1].net_total, 60)
      assert.equal(
        itemRows[0].adjustments,
        JSON.stringify([{ label: 'Line discount', calculation: 'FIXED', value: -10 }]),
        'InvoiceItems.adjustments must be serialized before SheetLib receives the DB row',
      )
      assert.equal(itemRows[1].adjustments, '[]')

      // ── Invoice: one APPEND, alone ──
      const invoiceCall = calls[1]
      const invoiceBody = invoiceCall.body!
      assert.equal(invoiceBody.action, 'APPEND')
      const invoiceRow = invoiceBody.data as Record<string, unknown>
      assert.equal(invoiceRow.invoice_number, 'INV-0001')
      assert.equal(invoiceRow.status, 'ISSUED')
      assert.equal(
        invoiceRow.customer,
        JSON.stringify({ customer_code: 'CUS-0001', customer_name: 'Somchai' }),
        'Invoices.customer must be serialized before SheetLib receives the DB row',
      )
      assert.equal(invoiceRow.adjustments, '[]')

      // ── OrderForm: one UPDATE, key_value = sourceOrderId, PATCH-only body ──
      const orderFormCall = calls[4]
      assert.equal(orderFormCall.body?.valueInputOption, 'USER_ENTERED')
      assert.deepEqual(orderFormCall.body?.data, [
        { range: 'OrderForm!S2:S2', values: [['INV-0001']] },
        { range: 'OrderForm!R2:R2', values: [['staff']] },
        { range: 'OrderForm!Q2:Q2', values: [['2026-04-01 07:34:56']] },
      ])
    },
  )

  console.log('1 invoice SheetLib transport workflow test passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
