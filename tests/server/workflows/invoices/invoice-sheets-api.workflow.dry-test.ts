import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { CreateInvoiceRequest } from '../../../../contracts/invoices/invoice-api.schema.js'
import {
  invoiceItemsDbContract,
  invoiceItemsRowSchema,
} from '../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import {
  invoicesDbContract,
  invoicesRowSchema,
} from '../../../../server/sheets/Invoices/Invoices.db-contract.js'
import { orderFormDbContract } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { SheetRepository } from '../../../../server/shared/repositories/sheet.repository.js'

/**
 * Sheets API workflow.
 *
 * Exercises the REAL `InvoiceService` against a mocked `fetch`, asserting the
 * exact wire-level requests: one InvoiceItems batch append and one Invoices
 * append through the Sheets API, plus an OrderForm keyed PATCH through the
 * Sheets API with only the invoice link fields.
 *
 * The repositories are real SheetRepository instances with only their clock,
 * item-id generator, and the separate view-sync endpoint stubbed (see the call
 * site), which keeps the asserted request bodies meaningful.
 */

process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'invoice-workflow@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { InvoiceService } = await import('../../../../server/modules/invoices/invoice.service.js')

const fixedNow = new Date('2026-04-01T00:34:56.000Z')

const invoiceItemsHeaders = Object.keys(invoiceItemsRowSchema.shape)
const invoicesHeaders = Object.keys(invoicesRowSchema.shape)

assert.equal(invoiceItemsHeaders.length, 14, 'InvoiceItems physical width is fourteen columns')
assert.equal(invoiceItemsHeaders[5], 'sku', 'sku is the sixth InvoiceItems column')
assert.equal(invoicesHeaders.length, 16, 'Invoices physical width is sixteen columns')

interface FetchCall {
  url: string
  method?: string
  body?: Record<string, unknown>
}

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

function appendResponse(spreadsheetId: string, sheetName: string, endColumn: string, values: unknown[][]): Response {
  return response({
    json: {
      spreadsheetId,
      updates: {
        updatedRows: values.length,
        updatedRange: `${sheetName}!A2:${endColumn}${values.length + 1}`,
        updatedData: { values },
      },
    },
  })
}

function sheetsPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname)
}

function isAppendPath(url: string, sheetName: string): boolean {
  const endColumn = sheetName === 'InvoiceItems' ? 'N' : 'P'
  return sheetsPath(url).endsWith(`/values/${sheetName}!A:${endColumn}:append`)
}

async function withRoutedFetch<T>(
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

    assert.equal(parsedUrl.origin, 'https://sheets.googleapis.com')
    const call: FetchCall = {
      url: stringUrl,
      method: init?.method,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) as Record<string, unknown>,
    }
    calls.push(call)
    const path = sheetsPath(stringUrl)

    // ── InvoiceItems: header load + one batch append ──
    if (init?.method === 'GET' && path.endsWith('/values/InvoiceItems!1:1')) {
      return response({ json: { values: [invoiceItemsHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/InvoiceItems!B:B')) {
      return response({ json: { values: [['invoice_item_id']] } })
    }
    if (init?.method === 'POST' && path.endsWith('/values/InvoiceItems!A:N:append')) {
      assert.equal(parsedUrl.searchParams.get('valueInputOption'), 'USER_ENTERED')
      assert.equal(parsedUrl.searchParams.get('insertDataOption'), 'INSERT_ROWS')
      assert.equal(parsedUrl.searchParams.get('includeValuesInResponse'), 'true')
      const values = call.body?.values as unknown[][]
      return appendResponse('invoices-spreadsheet-id', 'InvoiceItems', 'N', values)
    }

    // ── Invoices: header load + one append ──
    if (init?.method === 'GET' && path.endsWith('/values/Invoices!1:1')) {
      return response({ json: { values: [invoicesHeaders] } })
    }
    if (init?.method === 'GET' && path.endsWith('/values/Invoices!A:A')) {
      return response({ json: { values: [['invoice_number']] } })
    }
    if (init?.method === 'POST' && path.endsWith('/values/Invoices!A:P:append')) {
      assert.equal(parsedUrl.searchParams.get('valueInputOption'), 'USER_ENTERED')
      assert.equal(parsedUrl.searchParams.get('insertDataOption'), 'INSERT_ROWS')
      assert.equal(parsedUrl.searchParams.get('includeValuesInResponse'), 'true')
      const values = call.body?.values as unknown[][]
      return appendResponse('invoices-spreadsheet-id', 'Invoices', 'P', values)
    }

    // ── OrderForm: lookup + PATCH + verify (unchanged Sheets API path) ──
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
  let itemIdIndex = 0
  const service = new InvoiceService({
    invoiceRepository: () =>
      new SheetRepository({ contract: invoicesDbContract, now: () => fixedNow }),
    invoiceItemRepository: () =>
      new SheetRepository({ contract: invoiceItemsDbContract, now: () => fixedNow }),
    orderFormRepository: () =>
      new SheetRepository({ contract: orderFormDbContract, now: () => fixedNow }),
    // The Apps Script view-sync integration is a separate URL/endpoint;
    // stub it so this test focuses on the three source-sheet writes.
    syncInvoiceView: async () => ({ outcome: 'confirmed' }),
    generateItemId: () => {
      itemIdIndex += 1
      // 8-char primary keys matching invoice_item_id length.
      return `itemid0${itemIdIndex}`
    },
  })

  await withRoutedFetch(async (calls) => {
    const result = await service.create(baseRequest())
    assert.equal(result.kind, 'created')

    // Source-sheet writes use the Sheets API; view synchronization is a
    // separate endpoint.
    assert.equal(calls.length, 8, 'header×3 + primary-key read×1 + append×2 + update×2')
    assert.deepEqual(
      calls.map((call) => `${call.method ?? 'GET'} ${sheetsPath(call.url).replace(/^\/v4\/spreadsheets\/[^/]+/, '')}`),
      [
        'GET /values/InvoiceItems!1:1',
        'POST /values/InvoiceItems!A:N:append',
        'GET /values/Invoices!1:1',
        'POST /values/Invoices!A:P:append',
        'GET /values/OrderForm!1:1',
        'GET /values/OrderForm!A:A',
        'POST /values:batchUpdate',
        'GET /values/OrderForm!A2:U2',
      ],
    )

    const itemAppendCalls = calls.filter((call) => isAppendPath(call.url, 'InvoiceItems'))
    const invoiceAppendCalls = calls.filter((call) => isAppendPath(call.url, 'Invoices'))
    assert.equal(itemAppendCalls.length, 1, 'InvoiceItems: exactly one batch append, never one-per-row')
    assert.equal(invoiceAppendCalls.length, 1, 'Invoices: exactly one append')

    // ── InvoiceItems: one batch append, full-width rows, sku blank ──
    const itemsBody = itemAppendCalls[0]!.body!
    assert.equal(itemsBody.majorDimension, 'ROWS')
    const itemRows = itemsBody.values as unknown[][]
    assert.equal(itemRows.length, 2, 'both line items travel in the same append body')

    const expectedItemAdjustments0 = [{ label: 'Line discount', calculation: 'FIXED', value: -10 }]
    const expectedItemRows = [
      // sku is sixth of fourteen and never sent by the service → ''
      // net_total server-computed: FIXED -10 per unit × quantity 10 = 400, not 490.
      [
        'INV-0001',
        'itemid01',
        1,
        'ORD-0001',
        '',
        '',
        '',
        'Wash and fold',
        10,
        '',
        50,
        500,
        JSON.stringify(expectedItemAdjustments0),
        400,
      ],
      [
        'INV-0001',
        'itemid02',
        2,
        'ORD-0001',
        '',
        '',
        '',
        'Iron',
        3,
        '',
        20,
        60,
        '[]',
        60,
      ],
    ]
    assert.deepEqual(itemRows, expectedItemRows)
    for (const row of itemRows) {
      assert.equal(row.length, 14, 'every item row is full header width')
      assert.equal(row[5], '', 'sku stays a blank middle cell so later columns do not shift left')
    }
    assert.deepEqual(
      JSON.parse(String(itemRows[0]![12])),
      expectedItemAdjustments0,
      'InvoiceItems.adjustments must be single-encoded JSON whose parsed value is the adjustment object',
    )
    assert.deepEqual(
      JSON.parse(String(itemRows[1]![12])),
      [],
      'empty InvoiceItems.adjustments must parse to an empty array, not a string',
    )

    // ── Invoices: one append, full-width row ──
    const invoiceBody = invoiceAppendCalls[0]!.body!
    assert.equal(invoiceBody.majorDimension, 'ROWS')
    const invoiceRows = invoiceBody.values as unknown[][]
    assert.equal(invoiceRows.length, 1)
    const invoiceRow = invoiceRows[0]!
    assert.equal(invoiceRow.length, 16, 'invoice header row is full header width')

    const expectedCustomer = { customer_code: 'CUS-0001', customer_name: 'Somchai' }
    const expectedInvoiceRow = [
      'INV-0001',
      'ISSUED',
      'ORDER',
      '',
      '',
      '2026-07-29',
      '2026-08-12',
      'CUS-0001',
      JSON.stringify(expectedCustomer),
      '[]',
      'staff',
      '2026-04-01 07:34:56',
      '',
      '',
      '',
      '',
    ]
    assert.deepEqual(invoiceRow, expectedInvoiceRow)
    assert.deepEqual(
      JSON.parse(String(invoiceRow[8])),
      expectedCustomer,
      'Invoices.customer must be single-encoded JSON whose parsed value is the customer object',
    )
    assert.deepEqual(
      JSON.parse(String(invoiceRow[9])),
      [],
      'Invoices.adjustments must be single-encoded JSON whose parsed value is an array',
    )

    // ── OrderForm: one UPDATE, PATCH-only body (assertions also live in the mock) ──
    const orderFormCall = calls[6]!
    assert.equal(orderFormCall.body?.valueInputOption, 'USER_ENTERED')
    assert.deepEqual(orderFormCall.body?.data, [
      { range: 'OrderForm!S2:S2', values: [['INV-0001']] },
      { range: 'OrderForm!R2:R2', values: [['staff']] },
      { range: 'OrderForm!Q2:Q2', values: [['2026-04-01 07:34:56']] },
    ])
  })

  console.log('1 invoice Sheets API transport workflow test passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
