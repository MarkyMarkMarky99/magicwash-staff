import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../contracts/invoices/invoice-api.schema.js'

/**
 * Layer 2 — SheetLib transport workflow
 * (docs/invoice-module-refactor-plan.md's Workflow Test Plan).
 *
 * Exercises the REAL `InvoiceService` (default-constructed repositories, no
 * injected fakes) against a mocked `fetch`, asserting the exact wire-level
 * requests: one `InvoiceItem` APPEND with an ordered `data[]` array, one
 * `Invoice` APPEND, and one `OrderForm` UPDATE with `key_value=sourceOrderId`
 * and only the invoice-link PATCH fields — all against `APPSCRIPT_URL` with
 * an explicit target, never `APPSCRIPT_GATEWAY_URL` and never a GViz
 * read-back.
 */

process.env.APPSCRIPT_URL = 'https://script.example/exec'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'

const { InvoiceService } = await import('../../../../server/modules/invoices/invoice.service.js')

interface FetchCall {
  url: string
  body: Record<string, unknown>
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

/** Dispatches by the envelope's `target` field — mirrors the real gateway
 *  routing InvoiceItem/Invoice/OrderForm requests that all land on the same
 *  APPSCRIPT_URL. Fails loudly if anything hits a URL other than
 *  APPSCRIPT_URL (e.g. a stray APPSCRIPT_GATEWAY_URL call or a GViz read). */
async function withRoutedFetch<T>(
  handlers: Record<string, FetchHandler>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string, init?: RequestInit) => {
    const stringUrl = String(url)
    assert.equal(stringUrl, process.env.APPSCRIPT_URL, 'every write must target APPSCRIPT_URL, never a GViz read or a different gateway')
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ url: stringUrl, body })
    const target = body.target as string
    const handler = handlers[target]
    if (!handler) {
      throw new Error(`No fetch handler configured for target ${target}`)
    }
    return handler(body)
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
    // The Apps Script view-sync integration is a separate URL/endpoint,
    // deliberately out of scope for this SheetLib-transport-only layer —
    // stub it so this test focuses purely on the three SheetLib writes.
    syncInvoiceView: async () => ({ outcome: 'confirmed' }),
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

      assert.equal(calls.length, 3, 'exactly one InvoiceItem APPEND, one Invoice APPEND, one OrderForm UPDATE')
      assert.deepEqual(calls.map((call) => call.body.target), ['InvoiceItem', 'Invoice', 'OrderForm'])

      // ── InvoiceItem: one APPEND, ordered data[] array, no loop ──
      const itemsCall = calls[0]
      assert.equal(itemsCall.body.resource, 'sheet')
      assert.equal(itemsCall.body.action, 'APPEND')
      assert.ok(Array.isArray(itemsCall.body.data))
      const itemRows = itemsCall.body.data as Array<Record<string, unknown>>
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
      assert.equal(invoiceCall.body.action, 'APPEND')
      const invoiceRow = invoiceCall.body.data as Record<string, unknown>
      assert.equal(invoiceRow.invoice_number, 'INV-0001')
      assert.equal(invoiceRow.status, 'ISSUED')
      assert.equal(
        invoiceRow.customer,
        JSON.stringify({ customer_code: 'CUS-0001', customer_name: 'Somchai' }),
        'Invoices.customer must be serialized before SheetLib receives the DB row',
      )
      assert.equal(invoiceRow.adjustments, '[]')

      // ── OrderForm: one UPDATE, key_value = sourceOrderId, PATCH-only body ──
      const orderFormCall = calls[2]
      assert.equal(orderFormCall.body.action, 'UPDATE')
      assert.equal(orderFormCall.body.key_value, 'ORD-0001')
      assert.deepEqual(orderFormCall.body.data, { invoice_id: 'INV-0001', updated_by: 'staff' })
    },
  )

  console.log('1 invoice SheetLib transport workflow test passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
