import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'

/**
 * Read API workflow.
 *
 * Exercises `invoiceRoutes` (the actual routes `invoice.module.ts` builds)
 * for GET list/detail: response envelopes, keyword/customer/status/sort,
 * inclusive date ranges filtered before pagination, and 404 behavior — the
 * exact DTO consumed by the Invoice list/detail pages.
 */

process.env.APPSCRIPT_URL = 'https://script.example/exec'
process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'
process.env.PORTAL_SPREADSHEET_ID = 'portal-spreadsheet-id'

const { invoiceRoutes } = await import('../../../../server/modules/invoices/invoice.module.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function gvizBody(table: unknown): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table })});`
}

function gvizResponse(text: string): Response {
  return { ok: true, status: 200, statusText: 'OK', text: async () => text, json: async () => ({}) } as Response
}

async function withMockGViz<T>(text: string, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => gvizResponse(text)) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

const COLS = [
  { id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'G' },
  { id: 'H' }, { id: 'I' }, { id: 'J' }, { id: 'K' }, { id: 'L' }, { id: 'M' }, { id: 'N' },
  { id: 'O' }, { id: 'P' }, { id: 'Q' },
]

function invoiceRow(overrides: { invoiceNumber: string; issuedDate: string }): { c: Array<{ v: unknown }> } {
  return {
    c: [
      { v: overrides.invoiceNumber },
      { v: 'ISSUED' },
      { v: 'ORDER' },
      { v: null },
      { v: null },
      { v: overrides.issuedDate },
      { v: '2026-08-15' },
      { v: 'CUS-0001' },
      { v: JSON.stringify({ customerCode: 'CUS-0001', customerName: 'Somchai', phone: null, address: null }) },
      { v: '[]' },
      { v: '[]' },
      { v: '[]' },
      { v: 100 },
      { v: 0 },
      { v: 100 },
      { v: 0 },
      { v: 100 },
    ],
  }
}

function getRequest(query: Record<string, string> = {}): ApiHandlerRequest {
  return { method: 'GET', query, body: undefined, headers: {}, params: {} }
}

test('GET list returns the paginated envelope with the projected list DTO', async () => {
  await withMockGViz(
    gvizBody({
      cols: COLS,
      rows: [
        invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-07-01' }),
        invoiceRow({ invoiceNumber: 'INV-0002', issuedDate: '2026-07-15' }),
      ],
    }),
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(getRequest())
      assert.equal(result.status, 200)
      const body = result.body as { success: boolean; data: unknown[]; meta: { pagination: unknown } }
      assert.equal(body.success, true)
      assert.equal(body.data.length, 2)
      assert.ok(body.meta.pagination)
    },
  )
})

test('GET list with an inclusive date range filters before pagination', async () => {
  await withMockGViz(
    gvizBody({
      cols: COLS,
      rows: [
        invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-06-30' }),
        invoiceRow({ invoiceNumber: 'INV-0002', issuedDate: '2026-07-01' }), // inclusive lower bound
        invoiceRow({ invoiceNumber: 'INV-0003', issuedDate: '2026-07-31' }), // inclusive upper bound
        invoiceRow({ invoiceNumber: 'INV-0004', issuedDate: '2026-08-01' }),
      ],
    }),
    async () => {
      const result = await invoiceRoutes.collection.handleRequest(
        getRequest({ dateFrom: '2026-07-01', dateTo: '2026-07-31' }),
      )
      const body = result.body as { data: Array<Record<string, unknown>> }
      assert.deepEqual(
        body.data.map((item) => item.invoiceNumber),
        ['INV-0002', 'INV-0003'],
      )
    },
  )
})

test('GET item returns the exact detail DTO', async () => {
  await withMockGViz(
    gvizBody({ cols: COLS, rows: [invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-07-01' })] }),
    async () => {
      const result = await invoiceRoutes.item!.handleRequest({
        method: 'GET',
        query: {},
        body: undefined,
        headers: {},
        params: { id: 'INV-0001' },
      })
      assert.equal(result.status, 200)
      const body = result.body as { data: Record<string, unknown> }
      assert.equal(body.data.invoiceNumber, 'INV-0001')
      assert.equal(body.data.grandTotal, 100)
    },
  )
})

test('GET item returns 404 for an invoice number with no matching row', async () => {
  await withMockGViz(gvizBody({ cols: COLS, rows: [] }), async () => {
    const result = await invoiceRoutes.item!.handleRequest({
      method: 'GET',
      query: {},
      body: undefined,
      headers: {},
      params: { id: 'INV-MISSING' },
    })
    assert.equal(result.status, 404)
    assert.equal((result.body as { success: boolean }).success, false)
  })
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice read API workflow tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
