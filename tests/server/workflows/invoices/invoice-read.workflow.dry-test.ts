import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'

process.env.INVOICES_SPREADSHEET_ID = 'invoices-spreadsheet-id'

const { invoiceRoutes } = await import('../../../../server/modules/invoices/invoice.module.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function gvizBody(columnCount: number, rows: unknown[][]): string {
  const cols = Array.from({ length: columnCount }, (_value, index) => ({ id: String.fromCharCode(65 + index) }))
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: { cols, rows: rows.map((values) => ({ c: values.map((value) => ({ v: value })) })) },
  })});`
}

function invoiceRow(invoiceNumber: string, issuedDate: string): unknown[] {
  return [
    invoiceNumber, 'ISSUED', 'ORDER', null, null, issuedDate, '2026-09-30', 'CUS-0001',
    JSON.stringify({ customer_code: 'CUS-0001', customer_name: 'Somchai', phone: null, address: null }),
    '[]', 'staff', null, null, null, null, null,
  ]
}

function itemRow(invoiceNumber: string): unknown[] {
  return [invoiceNumber, 'item0001', 1, null, null, null, null, 'Laundry', 1, 'KG', 100, 100, '[]', 100]
}

async function withMockSources<T>(invoices: unknown[][], run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: URL | string) => {
    const sheet = new URL(String(input)).searchParams.get('sheet')
    const text = sheet === 'Invoices'
      ? gvizBody(16, invoices)
      : sheet === 'InvoiceItems'
        ? gvizBody(14, invoices.map((row) => itemRow(String(row[0]))))
        : gvizBody(16, [])
    return { ok: true, status: 200, statusText: 'OK', text: async () => text } as Response
  }) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function getRequest(query: Record<string, string> = {}): ApiHandlerRequest {
  return { method: 'GET', query, body: undefined, headers: {}, params: {} }
}

test('GET list returns total pagination metadata and the projected list DTO', async () => {
  await withMockSources([
    invoiceRow('INV-0001', '2026-07-01'),
    invoiceRow('INV-0002', '2026-07-15'),
  ], async () => {
    const result = await invoiceRoutes.collection.handleRequest(getRequest({ page: '1', perPage: '1' }))
    assert.equal(result.status, 200)
    const body = result.body as { success: boolean; data: Array<Record<string, unknown>>; meta: { pagination: Record<string, number> } }
    assert.equal(body.success, true)
    assert.equal(body.data.length, 1)
    assert.deepEqual(body.meta.pagination, { total: 2, page: 1, perPage: 1, totalPages: 2 })
    assert.equal('items' in body.data[0]!, false)
  })
})

test('GET list applies inclusive date filtering before descending sort and pagination', async () => {
  await withMockSources([
    invoiceRow('INV-0001', '2026-06-30'),
    invoiceRow('INV-0002', '2026-07-01'),
    invoiceRow('INV-0003', '2026-07-31'),
    invoiceRow('INV-0004', '2026-08-01'),
  ], async () => {
    const result = await invoiceRoutes.collection.handleRequest(
      getRequest({ dateFrom: '2026-07-01', dateTo: '2026-07-31' }),
    )
    const body = result.body as { data: Array<Record<string, unknown>> }
    assert.deepEqual(body.data.map((row) => row.invoiceNumber), ['INV-0003', 'INV-0002'])
  })
})

test('GET item returns the assembled detail DTO', async () => {
  await withMockSources([invoiceRow('INV-0001', '2026-07-01')], async () => {
    const result = await invoiceRoutes.item!.handleRequest({
      method: 'GET', query: {}, body: undefined, headers: {}, params: { id: 'INV-0001' },
    })
    assert.equal(result.status, 200)
    const body = result.body as { data: Record<string, unknown> }
    assert.equal(body.data.invoiceNumber, 'INV-0001')
    assert.equal(body.data.grandTotal, 100)
  })
})

test('GET item returns 404 for an absent source header', async () => {
  await withMockSources([], async () => {
    const result = await invoiceRoutes.item!.handleRequest({
      method: 'GET', query: {}, body: undefined, headers: {}, params: { id: 'INV-MISSING' },
    })
    assert.equal(result.status, 404)
    assert.equal((result.body as { success: boolean }).success, false)
  })
})

for (const item of tests) await item.run()
console.log(`${tests.length} invoice read API workflow tests passed`)
