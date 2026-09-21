import assert from 'node:assert/strict'

import { resolveRoute } from '../../../../../server/api/route-registry.js'

const envKeys = ['PRINT_SERVER_URL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch
const payload = {
  customerIndex: '1999',
  totalCount: 3,
  tags: [
    { sequence: 1, tagId: '12345678' },
    { sequence: 2, tagId: '23456789' },
    { sequence: 3, tagId: '34567890' },
  ],
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
    return {
      ok: true,
      json: async () => ({
        success: true,
        accepted: true,
        printerName: 'TSC Test',
        totalCount: 3,
      }),
    } as Response
  }) as typeof fetch

  const routes = await resolveRoute('laundry-tag-prints')
  assert.ok(routes.collection)
  assert.equal(routes.item, undefined)

  const success = await routes.collection.handleRequest(request(payload))
  assert.equal(success.status, 200)
  assert.equal(fetchCall?.url, 'https://printer.example/base/print-order-tags')
  assert.equal(fetchCall?.init?.method, 'POST')
  assert.equal((fetchCall?.init?.headers as Record<string, string>)['CF-Access-Client-Id'], 'client-id')
  assert.equal((fetchCall?.init?.headers as Record<string, string>)['CF-Access-Client-Secret'], 'client-secret')
  assert.deepEqual(JSON.parse(String(fetchCall?.init?.body)), payload)

  const invalid = await routes.collection.handleRequest(request({ ...payload, tags: payload.tags.slice(1) }))
  assert.equal(invalid.status, 422)

  globalThis.fetch = (async () => ({ ok: false, status: 502 }) as Response) as typeof fetch
  const upstreamFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(upstreamFailure.status, 502)
  assert.doesNotMatch(JSON.stringify(upstreamFailure.body), /printer\.example|client-secret/)

  delete process.env.CF_ACCESS_CLIENT_SECRET
  const configurationFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(configurationFailure.status, 500)
  assert.match(JSON.stringify(configurationFailure.body), /CF_ACCESS_CLIENT_SECRET/)

  console.log('laundry tag print module dry tests passed')
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
