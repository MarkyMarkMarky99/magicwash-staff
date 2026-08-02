import assert from 'node:assert/strict'
import {
  orderFormContract,
  orderFormFieldMap,
  orderFormRowSchema,
} from '../../../../../server/modules/orders/order.contract.js'
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

test('OrderForm row field order matches the live schema (OrderForm.json property order)', () => {
  const expectedColumns = {
    id: 'A',
    order_number: 'B',
    customer_id: 'C',
    received_date: 'D',
    due_date: 'E',
    service_type: 'F',
    status: 'G',
    quantity: 'H',
    hangers: 'I',
    bags: 'J',
    hangers_image: 'K',
    bags_image: 'L',
    form_image: 'M',
    note: 'N',
    timestamp: 'O',
    created_by: 'P',
    updated_at: 'Q',
    updated_by: 'R',
    invoice_id: 'S',
    order_name: 'T',
    order_description: 'U',
  }
  assert.deepEqual(deriveGVizColumns(orderFormRowSchema), expectedColumns)
  assert.equal(orderFormFieldMap.invoice_id, 'invoiceId')
  assert.equal(orderFormContract.db.primaryKey, 'id')
})

test('OrderForm repository update sends key_value = order id and only the invoice-link patch + updatedBy', async () => {
  const repo = new GSheetRepository({
    contract: orderFormContract,
    sheetName: 'OrderForm',
    target: 'OrderForm',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () =>
      response({
        json: { status: 'ok', target: 'OrderForm', data: { id: 'ORD-0001', invoice_id: 'INV-0001' } },
      }),
    async (calls) => {
      await repo.update('ORD-0001', { invoiceId: 'INV-0001', updatedBy: 'staff' })

      assert.equal(calls.length, 1)
      const body = postBody(calls[0])
      assert.equal(body.action, 'UPDATE')
      assert.equal(body.target, 'OrderForm')
      assert.equal(body.key_value, 'ORD-0001')
      assert.deepEqual(body.data, { invoice_id: 'INV-0001', updated_by: 'staff' })
    },
  )
})

test('OrderForm repository create is unsupported — rejects before any fetch', async () => {
  const repo = new GSheetRepository({
    contract: orderFormContract,
    sheetName: 'OrderForm',
    target: 'OrderForm',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for unsupported OrderForm create')
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

test('OrderForm repository update rejects on a definite SheetLib rejection with a typed error', async () => {
  const repo = new GSheetRepository({
    contract: orderFormContract,
    sheetName: 'OrderForm',
    target: 'OrderForm',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  const { SheetLibRejectedError } = await import('../../../../../server/shared/repositories/sheetlib-errors.js')

  await withMockFetch(
    async () => response({ json: { status: 'error', message: 'OrderForm row not found' } }),
    async () => {
      await assert.rejects(
        () => repo.update('ORD-9999', { invoiceId: 'INV-0001', updatedBy: 'staff' }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibRejectedError)
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
  console.log(`${tests.length} orderForm repository dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
