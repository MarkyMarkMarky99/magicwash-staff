import assert from 'node:assert/strict'
import {
  invoiceContract,
  invoiceItemContract,
  paymentContract,
  invoiceFieldMap,
  invoiceItemFieldMap,
  paymentFieldMap,
  invoiceRowSchema,
  invoiceItemRowSchema,
  paymentRowSchema,
} from '../../../../../server/modules/invoices/invoice.contract.js'
import { deriveGVizColumns } from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'
import { GSheetRepository } from '../../../../../server/shared/repositories/gsheet.repository.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

function response(input: { json?: unknown; ok?: boolean; statusText?: string }): Response {
  return {
    ok: input.ok ?? true,
    status: input.ok === false ? 502 : 200,
    statusText: input.statusText ?? 'OK',
    json: async () => input.json,
  } as Response
}

async function withMockFetch<T>(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }, init?: RequestInit) => {
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

function postBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(call.init?.body as string) as Record<string, unknown>
}

// ── Field map / column-order sanity per sheet — row order documents the
//    physical column order from the live JSON Schemas; this pins it. ──

test('Invoice row field order matches the live schema and every column has an explicit camelCase mapping', () => {
  const expectedColumns = {
    invoice_number: 'A',
    status: 'B',
    billing_type: 'C',
    billing_period_start: 'D',
    billing_period_end: 'E',
    issued_date: 'F',
    due_date: 'G',
    customer_id: 'H',
    customer: 'I',
    adjustments: 'J',
    created_by: 'K',
    created_at: 'L',
    updated_at: 'M',
    updated_by: 'N',
    deleted_at: 'O',
    deleted_by: 'P',
  }
  assert.deepEqual(deriveGVizColumns(invoiceRowSchema), expectedColumns)
  assert.deepEqual(
    invoiceFieldMap,
    Object.fromEntries(
      Object.entries({
        invoice_number: 'invoiceNumber',
        status: 'status',
        billing_type: 'billingType',
        billing_period_start: 'billingPeriodStart',
        billing_period_end: 'billingPeriodEnd',
        issued_date: 'issuedDate',
        due_date: 'dueDate',
        customer_id: 'customerId',
        customer: 'customer',
        adjustments: 'adjustments',
        created_by: 'createdBy',
        created_at: 'createdAt',
        updated_at: 'updatedAt',
        updated_by: 'updatedBy',
        deleted_at: 'deletedAt',
        deleted_by: 'deletedBy',
      }),
    ),
  )
})

test('InvoiceItem row field order matches the live schema including the unused sku column', () => {
  const expectedColumns = {
    invoice_number: 'A',
    invoice_item_id: 'B',
    item_no: 'C',
    source_order_id: 'D',
    source_item_id: 'E',
    sku: 'F',
    service_type: 'G',
    description: 'H',
    quantity: 'I',
    unit: 'J',
    unit_price: 'K',
    subtotal: 'L',
    adjustments: 'M',
    net_total: 'N',
  }
  assert.deepEqual(deriveGVizColumns(invoiceItemRowSchema), expectedColumns)
  assert.equal(invoiceItemFieldMap.sku, 'sku')
})

test('Payment row field order matches the live schema; primaryKey is paymentId', () => {
  const expectedColumns = {
    payment_id: 'A',
    invoice_number: 'B',
    amount: 'C',
    method: 'D',
    status: 'E',
    paid_at: 'F',
    reference: 'G',
    proof_url: 'H',
    slip_data: 'I',
    notes: 'J',
    created_at: 'K',
    created_by: 'L',
    updated_at: 'M',
    updated_by: 'N',
    deleted_at: 'O',
    deleted_by: 'P',
  }
  assert.deepEqual(deriveGVizColumns(paymentRowSchema), expectedColumns)
  assert.equal(paymentContract.db.primaryKey, 'paymentId')
})

// ── Payment: writes are unsupported in this rollout ──

test('Payment repository rejects create/update before any fetch — writes are unsupported', async () => {
  const repo = new GSheetRepository({
    contract: paymentContract,
    sheetName: 'Payments',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for unsupported Payment writes')
      return response({ json: {} })
    },
    async (calls) => {
      await assert.rejects(
        () => (repo as unknown as { create: (data: unknown) => Promise<unknown> }).create({}),
        /create is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

// ── Invoice: one APPEND, target "Invoice", explicit columns only ──

test('Invoice repository APPEND sends target "Invoice" and maps camelCase command to snake_case columns', async () => {
  const repo = new GSheetRepository({
    contract: invoiceContract,
    sheetName: 'Invoices',
    target: 'Invoice',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'Invoice',
          data: { invoice_number: 'INV-0001', status: 'ISSUED' },
        },
      }),
    async (calls) => {
      await repo.create({
        invoiceNumber: 'INV-0001',
        status: 'ISSUED',
        billingType: 'ORDER',
        issuedDate: '2026-07-29',
        dueDate: '2026-08-12',
        customerId: 'CUS-0001',
        customer: { customer_code: 'CUS-0001', customer_name: 'Somchai' },
        adjustments: [],
        createdBy: 'staff',
      })

      assert.equal(calls.length, 1)
      const body = postBody(calls[0])
      assert.equal(body.resource, 'sheet')
      assert.equal(body.action, 'APPEND')
      assert.equal(body.target, 'Invoice')
      assert.deepEqual(body.data, {
        invoice_number: 'INV-0001',
        status: 'ISSUED',
        billing_type: 'ORDER',
        issued_date: '2026-07-29',
        due_date: '2026-08-12',
        customer_id: 'CUS-0001',
        customer: { customer_code: 'CUS-0001', customer_name: 'Somchai' },
        adjustments: [],
        created_by: 'staff',
      })
    },
  )
})

// ── InvoiceItem: exactly one batchAppend for the whole array ──

test('InvoiceItem repository batchAppend sends one APPEND with an ordered array, target "InvoiceItem"', async () => {
  const repo = new GSheetRepository({
    contract: invoiceItemContract,
    sheetName: 'InvoiceItems',
    target: 'InvoiceItem',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  const rows = [
    {
      invoiceNumber: 'INV-0001',
      invoiceItemId: 'aaaaaaaa',
      itemNo: 1,
      sourceOrderId: 'ORD-0001',
      sourceItemId: null,
      serviceType: null,
      description: 'Wash and fold',
      quantity: 2,
      unit: null,
      unitPrice: 100,
      subtotal: 200,
      adjustments: [],
      netTotal: 200,
    },
    {
      invoiceNumber: 'INV-0001',
      invoiceItemId: 'bbbbbbbb',
      itemNo: 2,
      sourceOrderId: 'ORD-0001',
      sourceItemId: null,
      serviceType: null,
      description: 'Iron',
      quantity: 3,
      unit: null,
      unitPrice: 20,
      subtotal: 60,
      adjustments: [],
      netTotal: 60,
    },
  ]

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'InvoiceItem',
          data: rows.map((row) => ({ invoice_item_id: row.invoiceItemId })),
        },
      }),
    async (calls) => {
      const stored = await repo.batchAppend(rows)

      assert.equal(calls.length, 1, 'exactly one APPEND request for the whole batch, never a loop')
      const body = postBody(calls[0])
      assert.equal(body.action, 'APPEND')
      assert.equal(body.target, 'InvoiceItem')
      assert.ok(Array.isArray(body.data))
      assert.equal((body.data as unknown[]).length, 2)
      assert.deepEqual(
        (body.data as Array<Record<string, unknown>>).map((row) => row.item_no),
        [1, 2],
        'array order must survive into the request',
      )
      assert.deepEqual(
        stored.map((row) => (row as Record<string, unknown>).invoiceItemId),
        ['aaaaaaaa', 'bbbbbbbb'],
      )
    },
  )
})

test('InvoiceItem repository batchAppend rejects the whole batch on a SheetLib rejection — nothing partially applied', async () => {
  const repo = new GSheetRepository({
    contract: invoiceItemContract,
    sheetName: 'InvoiceItems',
    target: 'InvoiceItem',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => response({ json: { status: 'error', message: 'invalid row 2' } }),
    async () => {
      await assert.rejects(
        () =>
          repo.batchAppend([
            {
              invoiceNumber: 'INV-0001',
              invoiceItemId: 'aaaaaaaa',
              itemNo: 1,
              sourceOrderId: null,
              sourceItemId: null,
              serviceType: null,
              description: 'Wash',
              quantity: 1,
              unit: null,
              unitPrice: 10,
              subtotal: 10,
              adjustments: [],
              netTotal: 10,
            },
          ]),
        /SheetLib APPEND failed: invalid row 2/,
      )
    },
  )
})

test('InvoiceItem/Invoice repository writes throw a typed transport error, distinct from a rejection, on a network failure', async () => {
  const repo = new GSheetRepository({
    contract: invoiceContract,
    sheetName: 'Invoices',
    target: 'Invoice',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  const { SheetLibTransportError, SheetLibRejectedError } = await import(
    '../../../../../server/shared/repositories/sheetlib-errors.js'
  )

  await withMockFetch(
    async () => {
      throw new Error('ECONNRESET')
    },
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            invoiceNumber: 'INV-0001',
            status: 'ISSUED',
            billingType: 'ORDER',
            issuedDate: '2026-07-29',
            dueDate: '2026-08-12',
            customerId: 'CUS-0001',
            customer: { customer_code: 'CUS-0001', customer_name: 'Somchai' },
            adjustments: [],
            createdBy: 'staff',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          return true
        },
      )
    },
  )
})

test('Invoice repository write throws a typed transport error, distinct from a rejection, on a non-2xx HTTP response', async () => {
  const repo = new GSheetRepository({
    contract: invoiceContract,
    sheetName: 'Invoices',
    target: 'Invoice',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  const { SheetLibTransportError, SheetLibRejectedError } = await import(
    '../../../../../server/shared/repositories/sheetlib-errors.js'
  )

  await withMockFetch(
    async () => response({ ok: false, statusText: 'Bad Gateway' }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            invoiceNumber: 'INV-0001',
            status: 'ISSUED',
            billingType: 'ORDER',
            issuedDate: '2026-07-29',
            dueDate: '2026-08-12',
            customerId: 'CUS-0001',
            customer: { customer_code: 'CUS-0001', customer_name: 'Somchai' },
            adjustments: [],
            createdBy: 'staff',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(error instanceof Error ? error.message : '', /502/)
          return true
        },
      )
    },
  )
})

test('Invoice repository write throws a typed transport error, distinct from a rejection, on malformed JSON — the gateway may already have written the row', async () => {
  const repo = new GSheetRepository({
    contract: invoiceContract,
    sheetName: 'Invoices',
    target: 'Invoice',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  const { SheetLibTransportError, SheetLibRejectedError } = await import(
    '../../../../../server/shared/repositories/sheetlib-errors.js'
  )

  await withMockFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new SyntaxError('Unexpected token in JSON')
        },
      }) as unknown as Response,
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            invoiceNumber: 'INV-0001',
            status: 'ISSUED',
            billingType: 'ORDER',
            issuedDate: '2026-07-29',
            dueDate: '2026-08-12',
            customerId: 'CUS-0001',
            customer: { customer_code: 'CUS-0001', customer_name: 'Somchai' },
            adjustments: [],
            createdBy: 'staff',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          return true
        },
      )
    },
  )
})

test('InvoiceItem batchAppend classifies a POST-WRITE response-shape mismatch as transport-unknown, NEVER a rejection — the gateway already answered ok', async () => {
  const repo = new GSheetRepository({
    contract: invoiceItemContract,
    sheetName: 'InvoiceItems',
    target: 'InvoiceItem',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  const { SheetLibTransportError, SheetLibRejectedError } = await import(
    '../../../../../server/shared/repositories/sheetlib-errors.js'
  )

  const oneRow = {
    invoiceNumber: 'INV-0001',
    invoiceItemId: 'aaaaaaaa',
    itemNo: 1,
    sourceOrderId: null,
    sourceItemId: null,
    serviceType: null,
    description: 'Wash',
    quantity: 1,
    unit: null,
    unitPrice: 10,
    subtotal: 10,
    adjustments: [],
    netTotal: 10,
  }

  // Case 1: gateway answered ok but `data` isn't an array at all. This is
  // now caught by `write()`'s own `expectedShape: 'array'` guard (shared
  // with the single-row path's object guard), not a batchAppend-local check.
  await withMockFetch(
    async () => response({ json: { status: 'ok', target: 'InvoiceItem', data: { not: 'an array' } } }),
    async () => {
      await assert.rejects(
        () => repo.batchAppend([oneRow]),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(error instanceof Error ? error.message : '', /confirmed the write but "data" was not an array/)
          return true
        },
      )
    },
  )

  // Case 2: gateway answered ok with an array, but the wrong length — the
  // batch was almost certainly written; this must never look like "nothing
  // was written".
  await withMockFetch(
    async () =>
      response({
        json: { status: 'ok', target: 'InvoiceItem', data: [{ invoice_item_id: 'aaaaaaaa' }, { invoice_item_id: 'bbbbbbbb' }] },
      }),
    async () => {
      await assert.rejects(
        () => repo.batchAppend([oneRow]),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(error instanceof Error ? error.message : '', /gateway confirmed the write/)
          return true
        },
      )
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice repository dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
