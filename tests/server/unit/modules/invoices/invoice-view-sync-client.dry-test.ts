import assert from 'node:assert/strict'

process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL = 'https://script.example/invoice-view-sync'

const { syncInvoiceView } = await import('../../../../../server/modules/invoices/invoice-view-sync-client.js')

interface ResponseInput {
  ok?: boolean
  status?: number
  statusText?: string
  json?: unknown
  jsonError?: Error
}

function response(input: ResponseInput): Response {
  return {
    ok: input.ok ?? true,
    status: input.status ?? 200,
    statusText: input.statusText ?? 'OK',
    json: async () => {
      if (input.jsonError) throw input.jsonError
      return input.json
    },
  } as Response
}

async function withFetch<T>(fetchImplementation: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImplementation
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function main(): Promise<void> {
  let request: { url: string; init?: RequestInit } | undefined
  const success = await withFetch(
    (async (url, init) => {
      request = { url: String(url), init }
      return response({ json: { ok: true, invoiceNumber: 'INV-0001', action: 'updated' } })
    }) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(success, { outcome: 'confirmed' })
  assert.equal(request?.url, process.env.APPSCRIPT_INVOICE_VIEW_SYNC_URL)
  assert.equal(request?.init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { invoiceNumber: 'INV-0001' })

  const rejected = await withFetch(
    (async () => response({ json: { ok: false, message: 'View unavailable' } })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(rejected, { outcome: 'failed', message: 'View unavailable' })

  const nullBody = await withFetch(
    (async () => response({ json: null })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(nullBody, { outcome: 'failed', message: 'Invoice view sync response had an invalid shape' })

  const arrayBody = await withFetch(
    (async () => response({ json: [] })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(arrayBody, { outcome: 'failed', message: 'Invoice view sync response had an invalid shape' })

  const missingOk = await withFetch(
    (async () => response({ json: { message: 'Missing ok flag' } })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(missingOk, { outcome: 'failed', message: 'Missing ok flag' })

  const invalidJson = await withFetch(
    (async () => response({ jsonError: new Error('bad json') })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(invalidJson, { outcome: 'failed', message: 'Invoice view sync response was not valid JSON' })

  const httpFailure = await withFetch(
    (async () => response({ ok: false, status: 503, statusText: 'Service Unavailable' })) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(httpFailure, {
    outcome: 'failed',
    message: 'Invoice view sync HTTP 503 Service Unavailable',
  })

  const networkFailure = await withFetch(
    (async () => {
      throw new Error('network down')
    }) as typeof fetch,
    () => syncInvoiceView('INV-0001'),
  )
  assert.deepEqual(networkFailure, {
    outcome: 'failed',
    message: 'Invoice view sync request failed: network down',
  })

  console.log('invoice view sync client dry tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
