import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../../contracts/invoices/invoice-api.schema.js'

// Both invoice.gateway-client.ts and orderForm.repository.ts read
// APPSCRIPT_GATEWAY_URL lazily, inside each call — not at module scope — so
// it's safe to set this before importing createInvoice, same as any other
// dry test in this suite that needs an env var present.
process.env.APPSCRIPT_GATEWAY_URL = 'https://script.example/exec'
process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL = 'https://script.example/invoice-view-sync'

const { createInvoice } = await import('../../../../../server/modules/invoices/invoice.service.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

interface FetchCall {
  url: string
  body: Record<string, unknown>
}

type FetchHandler = (body: Record<string, unknown>) => Promise<Response>

function response(input: { json?: unknown; ok?: boolean; statusText?: string }): Response {
  return {
    ok: input.ok ?? true,
    status: input.ok === false ? 500 : 200,
    statusText: input.statusText ?? 'OK',
    json: async () => input.json,
  } as Response
}

/** Dispatches by the envelope's `target` field, mirroring how the real
 *  gateway would route InvoiceItem / Invoice / OrderForm requests that all
 *  land on the same APPSCRIPT_GATEWAY_URL. */
async function withRoutedFetch<T>(
  handlers: Record<string, FetchHandler>,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ url: String(url), body })
    const handlerKey = (body.target as string | undefined)
      ?? (String(url) === process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL ? 'InvoiceViewSync' : undefined)
    const handler = handlerKey ? handlers[handlerKey] : undefined
    if (!handler) {
      throw new Error(`No fetch handler configured for target ${String(handlerKey)}`)
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
    customer: {
      customerCode: 'CUS-0001',
      customerName: 'Somchai',
    },
    adjustments: [],
    items: [
      {
        description: 'Wash and fold',
        quantity: 2,
        unitPrice: 100,
        adjustments: [],
      },
    ],
  }
}

const okAppend: FetchHandler = async () =>
  response({ json: { resource: 'sheet', status: 'ok', target: 'x', updated_range: 'A1' } })

const okViewSync: FetchHandler = async () =>
  response({ json: { ok: true, invoiceNumber: 'INV-0001', action: 'updated' } })

test('createInvoice returns "created" when items, invoice, and the order-link write all succeed', async () => {
  await withRoutedFetch(
    {
      InvoiceItem: okAppend,
      Invoice: okAppend,
      OrderForm: async () => response({ json: { status: 'ok' } }),
      InvoiceViewSync: okViewSync,
    },
    async (calls) => {
      const result = await createInvoice(baseRequest())

      assert.equal(result.kind, 'created')
      assert.deepEqual(
        calls.map((call) => call.body.target ?? 'InvoiceViewSync'),
        ['InvoiceItem', 'Invoice', 'OrderForm', 'InvoiceViewSync'],
        'items, header, order link, and view sync must happen in that order',
      )
      // The OrderForm UPDATE carries key_value = sourceOrderId and the
      // invoice_number value under OrderForm's own invoice_id column name.
      const orderFormCall = calls[2]
      assert.equal(orderFormCall.body.action, 'UPDATE')
      assert.equal(orderFormCall.body.key_value, 'ORD-0001')
      assert.deepEqual(orderFormCall.body.data, {
        invoice_id: 'INV-0001',
        updated_by: 'staff',
      })
      assert.deepEqual(calls[3].body, { invoiceNumber: 'INV-0001' })
      assert.equal(calls[3].url, process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL)
    },
  )
})

test('createInvoice reports invoice_view_sync_failed after the source writes are complete', async () => {
  await withRoutedFetch(
    {
      InvoiceItem: okAppend,
      Invoice: okAppend,
      OrderForm: async () => response({ json: { status: 'ok' } }),
      InvoiceViewSync: async () => response({ json: { ok: false, message: 'View unavailable' } }),
    },
    async (calls) => {
      const result = await createInvoice(baseRequest())

      assert.deepEqual(result, {
        kind: 'invoice_view_sync_failed',
        invoiceNumber: 'INV-0001',
        message: 'View unavailable',
      })
      assert.equal(calls.length, 4)
    },
  )
})

test('createInvoice reports order_link_failed — never invoice_write_failed — when the order-mark step is explicitly rejected after a successful invoice write', async () => {
  await withRoutedFetch(
    {
      InvoiceItem: okAppend,
      Invoice: okAppend,
      OrderForm: async () => response({ json: { status: 'error', message: 'OrderForm row not found' } }),
    },
    async (calls) => {
      const result = await createInvoice(baseRequest())

      assert.deepEqual(result, {
        kind: 'order_link_failed',
        invoiceNumber: 'INV-0001',
        sourceOrderId: 'ORD-0001',
      })
      // Both prior writes still happened — the invoice IS fully recorded;
      // only the order-side linkage is missing.
      assert.equal(calls.length, 3)
    },
  )
})

test('createInvoice also reports order_link_failed (not a thrown error) when the order-mark request never gets a definitive answer', async () => {
  await withRoutedFetch(
    {
      InvoiceItem: okAppend,
      Invoice: okAppend,
      OrderForm: async () => {
        throw new Error('network hiccup')
      },
    },
    async () => {
      const result = await createInvoice(baseRequest())

      assert.deepEqual(result, {
        kind: 'order_link_failed',
        invoiceNumber: 'INV-0001',
        sourceOrderId: 'ORD-0001',
      })
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice service dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
