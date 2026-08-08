import assert from 'node:assert/strict'
import type { z } from 'zod'

process.env.PORTAL_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

const { InvoiceService } = await import('../../../../../server/modules/invoices/invoice.service.js')
const { invoicesViewDbContract, invoicesViewRowSchema } = await import(
  '../../../../../server/sheets/InvoicesView/InvoicesView.db-contract.js'
)
const { SheetRepository } = await import('../../../../../server/shared/repositories/sheet.repository.js')
const { ApiError } = await import('../../../../../server/shared/http/api-error.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function gvizBody(table: unknown): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table })});`
}

function response(input: { text?: string }): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => input.text ?? '',
    json: async () => ({}),
  } as Response
}

async function withMockFetch<T>(handler: (url: string) => Promise<Response>, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: URL | string) => handler(String(url))) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

// Columns A..Q per invoicePortalRowSchema's declared property order.
const COLS = [
  { id: 'A' }, // invoiceNumber
  { id: 'B' }, // status
  { id: 'C' }, // billingType
  { id: 'D' }, // billingPeriodStart
  { id: 'E' }, // billingPeriodEnd
  { id: 'F' }, // issuedDate
  { id: 'G' }, // dueDate
  { id: 'H' }, // customerId
  { id: 'I' }, // customer
  { id: 'J' }, // items
  { id: 'K' }, // adjustments
  { id: 'L' }, // payments
  { id: 'M' }, // subtotal
  { id: 'N' }, // adjustmentTotal
  { id: 'O' }, // grandTotal
  { id: 'P' }, // paidAmount
  { id: 'Q' }, // balanceDue
]

function invoiceRow(overrides: {
  invoiceNumber: string
  issuedDate: string
  customerId?: string
  status?: string
}): { c: Array<{ v: unknown }> } {
  return {
    c: [
      { v: overrides.invoiceNumber },
      { v: overrides.status ?? 'ISSUED' },
      { v: 'ORDER' },
      { v: null },
      { v: null },
      { v: overrides.issuedDate },
      { v: '2026-08-15' },
      { v: overrides.customerId ?? 'CUS-0001' },
      { v: JSON.stringify({ customerCode: overrides.customerId ?? 'CUS-0001', customerName: 'Somchai', phone: null, address: null }) },
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

function createService(): InstanceType<typeof InvoiceService> {
  const invoiceViewRepository = new SheetRepository<z.infer<typeof invoicesViewRowSchema>>({
    contract: invoicesViewDbContract,
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  return new InvoiceService({
    invoiceViewRepository,
  })
}

test('list() without a date range delegates to the generic read path and paginates', async () => {
  const service = createService()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: COLS,
          rows: [
            invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-07-01' }),
            invoiceRow({ invoiceNumber: 'INV-0002', issuedDate: '2026-07-15' }),
          ],
        }),
      }),
    async () => {
      const result = await service.list({ page: '1', perPage: '20' })
      assert.equal(result.items.length, 2)
      assert.deepEqual(
        result.items.map((item) => (item as Record<string, unknown>).invoiceNumber),
        ['INV-0001', 'INV-0002'],
      )
      assert.deepEqual(result.pagination, { page: 1, perPage: 20 })
    },
  )
})

test('list() with dateFrom/dateTo filters in JS after fetching every row matching the other filters', async () => {
  const service = createService()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: COLS,
          rows: [
            invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-06-30' }), // before range
            invoiceRow({ invoiceNumber: 'INV-0002', issuedDate: '2026-07-10' }), // in range
            invoiceRow({ invoiceNumber: 'INV-0003', issuedDate: '2026-07-20' }), // in range
            invoiceRow({ invoiceNumber: 'INV-0004', issuedDate: '2026-08-01' }), // after range
          ],
        }),
      }),
    async () => {
      const result = await service.list({ dateFrom: '2026-07-01', dateTo: '2026-07-31', page: '1', perPage: '20' })
      assert.deepEqual(
        result.items.map((item) => (item as Record<string, unknown>).invoiceNumber),
        ['INV-0002', 'INV-0003'],
      )
    },
  )
})

test('list() with a date range applies pagination AFTER filtering, not before', async () => {
  const service = createService()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: COLS,
          rows: [
            invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-01-01' }), // out of range, would occupy page 1 if filtered too late
            invoiceRow({ invoiceNumber: 'INV-0002', issuedDate: '2026-07-05' }),
            invoiceRow({ invoiceNumber: 'INV-0003', issuedDate: '2026-07-06' }),
          ],
        }),
      }),
    async () => {
      const result = await service.list({
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        page: '1',
        perPage: '1',
      })
      // Page 1 of the FILTERED set (2 matches) must be INV-0002, not the
      // out-of-range INV-0001 that would win if pagination ran first.
      assert.deepEqual(
        result.items.map((item) => (item as Record<string, unknown>).invoiceNumber),
        ['INV-0002'],
      )
    },
  )
})

test('getById() returns the exact detail DTO projection', async () => {
  const service = createService()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: COLS,
          rows: [invoiceRow({ invoiceNumber: 'INV-0001', issuedDate: '2026-07-01' })],
        }),
      }),
    async () => {
      const detail = await service.getById('INV-0001')
      assert.equal((detail as Record<string, unknown>).invoiceNumber, 'INV-0001')
      assert.equal((detail as Record<string, unknown>).grandTotal, 100)
    },
  )
})

test('getById() raises a 404 ApiError when no row matches', async () => {
  const service = createService()

  await withMockFetch(
    async () => response({ text: gvizBody({ cols: COLS, rows: [] }) }),
    async () => {
      await assert.rejects(
        () => service.getById('INV-MISSING'),
        (error: unknown) => {
          assert.ok(error instanceof ApiError)
          assert.equal((error as InstanceType<typeof ApiError>).status, 404)
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
  console.log(`${tests.length} invoice read dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
