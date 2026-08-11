import assert from 'node:assert/strict'
import type { z } from 'zod'
import { orderFormDbContract, orderFormRowSchema } from '../../../../server/sheets/OrderForm/OrderForm.db-contract.js'
import { SheetRepository } from '../../../../server/shared/repositories/sheet.repository.js'
import { WriteRejectedError } from '../../../../server/shared/repositories/sheets-api.client.js'
import { WriteRowIdentityMismatchError } from '../../../../server/shared/repositories/sheet-row-identity.js'

process.env.ORDERS_SPREADSHEET_ID = 'orders-spreadsheet-id'

type OrderFormRow = z.infer<typeof orderFormRowSchema>

interface FetchCall {
  readonly url: string
  readonly init: RequestInit | undefined
}

type FetchHandler = (call: FetchCall) => Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const headers = Object.keys(orderFormRowSchema.shape)
const fullRowValues = [
  'ORD-1',
  null,
  'CUS-1',
  '2026-08-01',
  '2026-08-03',
  'WSIR',
  'RECEIVED',
  2,
  1,
  0,
  null,
  null,
  null,
  null,
  null,
  'staff',
  '2026-08-10 15:00:00',
  'staff',
  'INV-1',
  'Order one',
  null,
] as const

function createRepository(): SheetRepository<OrderFormRow> {
  return new SheetRepository<OrderFormRow>({
    contract: orderFormDbContract,
    sheetsApiClientOptions: {
      fetchImpl: globalThis.fetch,
      accessTokenProvider: async () => 'test-access-token',
    },
  })
}

async function withMockFetch(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = async (input, init) => {
    const call = { url: String(input), init }
    calls.push(call)
    return handler(call)
  }

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>
}

function apiPath(call: FetchCall): string {
  return decodeURIComponent(new URL(call.url).pathname)
}

async function successfulUpdateHandler(call: FetchCall): Promise<Response> {
  const path = apiPath(call)
  if (call.init?.method === 'GET' && path.endsWith('/values/OrderForm!1:1')) {
    return jsonResponse({ values: [headers] })
  }
  if (call.init?.method === 'GET' && path.endsWith('/values/OrderForm!A:A')) {
    return jsonResponse({ values: [['id'], ['ORD-1']] })
  }
  if (call.init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
    return jsonResponse({ spreadsheetId: 'orders-spreadsheet-id', responses: [{}, {}, {}] })
  }
  if (call.init?.method === 'GET' && path.endsWith('/values/OrderForm!A2:U2')) {
    return jsonResponse({ values: [fullRowValues] })
  }
  throw new Error(`Unexpected Sheets API request: ${call.init?.method} ${path}`)
}

async function main(): Promise<void> {
  await withMockFetch(successfulUpdateHandler, async (calls) => {
    const result = await createRepository().update('ORD-1', {
      invoice_id: 'INV-1',
      updated_by: 'staff',
      updated_at: '2026-08-10 15:00:00',
    })

    assert.equal(calls.every((call) => new URL(call.url).origin === 'https://sheets.googleapis.com'), true)
    assert.deepEqual(requestBody(calls[2]), {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'OrderForm!S2:S2', values: [['INV-1']] },
        { range: 'OrderForm!R2:R2', values: [['staff']] },
        { range: 'OrderForm!Q2:Q2', values: [['2026-08-10 15:00:00']] },
      ],
    })
    assert.deepEqual(calls.map((call) => apiPath(call)), [
      '/v4/spreadsheets/orders-spreadsheet-id/values/OrderForm!1:1',
      '/v4/spreadsheets/orders-spreadsheet-id/values/OrderForm!A:A',
      '/v4/spreadsheets/orders-spreadsheet-id/values:batchUpdate',
      '/v4/spreadsheets/orders-spreadsheet-id/values/OrderForm!A2:U2',
    ])
    assert.deepEqual(result, Object.fromEntries(headers.map((header, index) => [header, fullRowValues[index]])))
    assert.equal(Object.keys(result).length, 21)
  })

  await withMockFetch(async (call) => {
    const path = apiPath(call)
    if (path.endsWith('/values/OrderForm!1:1')) {
      return jsonResponse({ values: [headers] })
    }
    if (path.endsWith('/values/OrderForm!A:A')) {
      return jsonResponse({ values: [['id'], ['ORD-OTHER']] })
    }
    throw new Error(`A missing key must not write: ${path}`)
  }, async (calls) => {
    await assert.rejects(
      () => createRepository().update('ORD-1', { invoice_id: 'INV-1' }),
      (error: unknown) => {
        assert.ok(error instanceof WriteRejectedError)
        assert.match(error.message, /No row found/)
        assert.equal(error.certainty, 'rejected')
        return true
      },
    )
    assert.equal(calls.length, 2)
  })

  await withMockFetch(async (call) => {
    const path = apiPath(call)
    if (path.endsWith('/values/OrderForm!1:1')) {
      return jsonResponse({ values: [headers] })
    }
    if (path.endsWith('/values/OrderForm!A:A')) {
      return jsonResponse({ values: [['id'], ['ORD-1']] })
    }
    if (path.endsWith('/values:batchUpdate')) {
      return jsonResponse({ spreadsheetId: 'orders-spreadsheet-id', responses: [{}] })
    }
    if (path.endsWith('/values/OrderForm!A2:U2')) {
      return jsonResponse({ values: [['ORD-MOVED', ...fullRowValues.slice(1)]] })
    }
    throw new Error(`Unexpected Sheets API request: ${path}`)
  }, async (calls) => {
    await assert.rejects(
      () => createRepository().update('ORD-1', { invoice_id: 'INV-1' }),
      (error: unknown) => {
        assert.ok(error instanceof WriteRowIdentityMismatchError)
        assert.equal(error.certainty, 'unknown')
        return true
      },
    )
    assert.equal(calls.length, 4)
  })

  console.log('3 OrderForm Sheets API update dry tests passed')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
