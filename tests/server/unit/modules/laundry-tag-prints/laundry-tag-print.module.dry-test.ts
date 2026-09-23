import assert from 'node:assert/strict'

import { resolveRoute } from '../../../../../server/api/route-registry.js'

const envKeys = ['PRINT_SERVER_URL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch
const originalConsoleError = console.error
const originalConsoleInfo = console.info
const failureLogs: string[] = []
const outcomeLogs: string[] = []
const payload = {
  customerIndex: '1999',
  totalCount: 3,
  tags: [
    { sequence: 1, tagId: '12345678' },
    { sequence: 2, tagId: 'Ab12Cd34' },
    { sequence: 3, tagId: 'Zz90Yy12' },
  ],
}
const request = (body: unknown) => ({
  method: 'POST', query: {}, body, headers: {}, params: {},
})

function latestFailureLog(): Record<string, unknown> {
  return JSON.parse(failureLogs[failureLogs.length - 1]!) as Record<string, unknown>
}

function assertSameErrorResponse(actual: unknown, expected: unknown): void {
  const normalizeTimestamp = (value: unknown) => JSON.parse(JSON.stringify(
    value,
    (key, nestedValue) => key === 'timestamp' ? '<timestamp>' : nestedValue,
  )) as unknown
  assert.deepEqual(normalizeTimestamp(actual), normalizeTimestamp(expected))
}

async function main(): Promise<void> {
  process.env.PRINT_SERVER_URL = 'https://printer.example/base'
  process.env.CF_ACCESS_CLIENT_ID = 'client-id'
  process.env.CF_ACCESS_CLIENT_SECRET = 'client-secret'
  console.error = (...args) => failureLogs.push(args.map(String).join(' '))
  console.info = (...args) => outcomeLogs.push(args.map(String).join(' '))

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
  const invalidTag = await routes.collection.handleRequest(request({
    ...payload,
    tags: [{ ...payload.tags[0], tagId: 'bad-tag!' }, ...payload.tags.slice(1)],
  }))
  assert.equal(invalidTag.status, 422)

  globalThis.fetch = (async () => new Response(
    `Cloudflare denied https://printer.example/base client-id client-secret ${'x'.repeat(600)}`,
    { status: 403, headers: { 'cf-ray': 'ray-id-BKK' } },
  )) as typeof fetch
  const upstreamFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(upstreamFailure.status, 502)
  assert.doesNotMatch(JSON.stringify(upstreamFailure.body), /printer\.example|client-secret/)
  const upstreamFailureBody = upstreamFailure.body

  const httpFailureLog = latestFailureLog()
  assert.equal(httpFailureLog.event, 'laundry_tag_print_failure')
  assert.equal(httpFailureLog.upstream, 'print_server')
  assert.equal(httpFailureLog.failureKind, 'http_error')
  assert.equal(httpFailureLog.status, 403)
  assert.equal(httpFailureLog.cfRay, 'ray-id-BKK')
  assert.equal(typeof httpFailureLog.elapsedMs, 'number')
  assert.equal(String(httpFailureLog.responseBodyPrefix).length, 500)
  assert.match(String(httpFailureLog.responseBodyPrefix), /Cloudflare denied \[REDACTED\]/)
  assert.doesNotMatch(failureLogs[failureLogs.length - 1]!, /printer\.example|client-id|client-secret/)

  const networkError = Object.assign(
    new Error('https://printer.example/base client-secret'),
    { code: 'ENOTFOUND' },
  )
  globalThis.fetch = (async () => { throw networkError }) as typeof fetch
  const networkFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(networkFailure.status, 502)
  assertSameErrorResponse(networkFailure.body, upstreamFailureBody)
  assert.deepEqual(
    { ...latestFailureLog(), elapsedMs: 0 },
    {
      event: 'laundry_tag_print_failure',
      upstream: 'print_server',
      elapsedMs: 0,
      failureKind: 'fetch_error',
      errorName: 'Error',
      errorCode: 'ENOTFOUND',
    },
  )

  globalThis.fetch = (async () => { throw new DOMException('Timed out', 'TimeoutError') }) as typeof fetch
  const timeoutFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(timeoutFailure.status, 502)
  assertSameErrorResponse(timeoutFailure.body, upstreamFailureBody)
  assert.equal(latestFailureLog().failureKind, 'fetch_timeout')

  globalThis.fetch = (async () => new Response('<html>', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch
  const invalidJsonFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(invalidJsonFailure.status, 502)
  assertSameErrorResponse(invalidJsonFailure.body, upstreamFailureBody)
  assert.equal(latestFailureLog().failureKind, 'invalid_json')

  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    accepted: false,
    printerName: 'TSC Test',
    totalCount: 3,
  }))) as typeof fetch
  const invalidSchemaFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(invalidSchemaFailure.status, 502)
  assertSameErrorResponse(invalidSchemaFailure.body, upstreamFailureBody)
  assert.equal(latestFailureLog().failureKind, 'invalid_response_schema')

  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    accepted: true,
    printerName: 'TSC Test',
    totalCount: 2,
  }))) as typeof fetch
  const countMismatchFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(countMismatchFailure.status, 502)
  assertSameErrorResponse(countMismatchFailure.body, upstreamFailureBody)
  assert.deepEqual(
    { ...latestFailureLog(), elapsedMs: 0 },
    {
      event: 'laundry_tag_print_failure',
      upstream: 'print_server',
      elapsedMs: 0,
      failureKind: 'mismatched_total_count',
      expectedTotalCount: 3,
      actualTotalCount: 2,
    },
  )

  delete process.env.CF_ACCESS_CLIENT_SECRET
  const configurationFailure = await routes.collection.handleRequest(request(payload))
  assert.equal(configurationFailure.status, 500)
  assert.match(JSON.stringify(configurationFailure.body), /CF_ACCESS_CLIENT_SECRET/)
  assert.equal(latestFailureLog().failureKind, 'configuration_error')

  assert.ok(outcomeLogs.some((line) => line.includes('"outcome":"accepted"')))
  assert.ok(outcomeLogs.some((line) => line.includes('"outcome":"upstream_error"')))
  assert.doesNotMatch(outcomeLogs.join('\n'), /printer\.example|client-id|client-secret|12345678/)

  console.log('laundry tag print module dry tests passed')
}

main()
  .catch((error) => {
    originalConsoleError(error)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
    console.info = originalConsoleInfo
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
