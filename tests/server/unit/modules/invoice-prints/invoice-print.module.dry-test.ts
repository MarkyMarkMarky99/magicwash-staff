import assert from 'node:assert/strict'

import { resolveRoute } from '../../../../../server/api/route-registry.js'

const envKeys = [
  'PRINT_SERVER_URL',
  'CF_ACCESS_CLIENT_ID',
  'CF_ACCESS_CLIENT_SECRET',
] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch

function response(input: { ok?: boolean; status?: number; body?: unknown }): Response {
  return {
    ok: input.ok ?? true,
    status: input.status ?? 200,
    json: async () => input.body,
  } as Response
}

const request = (body: unknown) => ({
  method: 'POST', query: {}, body, headers: {}, params: {},
})

async function main(): Promise<void> {
  process.env.PRINT_SERVER_URL = 'https://printer.example/base'
  process.env.CF_ACCESS_CLIENT_ID = 'client-id'
  process.env.CF_ACCESS_CLIENT_SECRET = 'client-secret'

  let fetchCall: { url: string; init?: RequestInit } | undefined
  globalThis.fetch = (async (url, init) => {
    fetchCall = { url: String(url), init }
    return response({
      body: {
        success: true,
        accepted: true,
        printerName: 'Shop Printer',
        invoiceNumber: 'INV001',
      },
    })
  }) as typeof fetch

  const routes = await resolveRoute('invoice-prints')
  assert.ok(routes.collection)
  assert.equal(routes.item, undefined)

  const success = await routes.collection.handleRequest(request({ invoiceNumber: ' INV001 ' }))
  assert.equal(success.status, 200)
  assert.deepEqual(success.body, {
    success: true,
    data: {
      success: true,
      accepted: true,
      printerName: 'Shop Printer',
      invoiceNumber: 'INV001',
    },
    meta: { timestamp: (success.body as { meta: { timestamp: string } }).meta.timestamp },
  })
  assert.equal(fetchCall?.url, 'https://printer.example/base/print-invoice')
  assert.equal(fetchCall?.init?.method, 'POST')
  assert.equal((fetchCall?.init?.headers as Record<string, string>)['CF-Access-Client-Id'], 'client-id')
  assert.equal((fetchCall?.init?.headers as Record<string, string>)['CF-Access-Client-Secret'], 'client-secret')
  assert.deepEqual(JSON.parse(String(fetchCall?.init?.body)), { invoiceNumber: 'INV001' })

  const invalid = await routes.collection.handleRequest(request({}))
  assert.equal(invalid.status, 422)

  globalThis.fetch = (async () => response({
    ok: false,
    status: 502,
    body: { error: 'raw upstream body', url: process.env.PRINT_SERVER_URL },
  })) as typeof fetch
  const upstreamFailure = await routes.collection.handleRequest(request({ invoiceNumber: 'INV001' }))
  assert.equal(upstreamFailure.status, 502)
  assert.doesNotMatch(JSON.stringify(upstreamFailure.body), /raw upstream body|printer\.example|client-secret/)

  delete process.env.CF_ACCESS_CLIENT_SECRET
  const configurationFailure = await routes.collection.handleRequest(request({ invoiceNumber: 'INV001' }))
  assert.equal(configurationFailure.status, 500)
  assert.match(JSON.stringify(configurationFailure.body), /CF_ACCESS_CLIENT_SECRET/)
  assert.doesNotMatch(JSON.stringify(configurationFailure.body), /client-secret|printer\.example/)

  console.log('invoice print module dry tests passed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
