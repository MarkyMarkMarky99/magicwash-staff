import assert from 'node:assert/strict'
import test from 'node:test'
import { callAiTask, checkAiGatewayHealth } from '../../../shared/ai-gateway/ai-gateway.client.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'
import { jsonResponse, successEnvelope } from './read-slip.fixture.js'

const options = { baseUrl: 'http://stub.invalid/', task: 'read-slip', input: { priceGroup: 'CRYO' }, getToken: async () => null }
const errorIs = (code: string, status = 0) => (error: unknown) => {
  assert.ok(error instanceof AiGatewayError)
  assert.equal(error.code, code)
  assert.equal(error.status, status)
  return true
}

test('success, multipart attachments, request id, file and Bearer token', async () => {
  const envelope = successEnvelope()
  const fetchImpl: typeof fetch = async (url, init) => {
    assert.equal(url, 'http://stub.invalid/tasks/read-slip')
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token')
    assert.equal(new Headers(init?.headers).has('Content-Type'), false)
    assert.ok(init?.body instanceof FormData)
    assert.deepEqual(JSON.parse(String(init.body.get('request'))), {
      requestId: 'custom', input: { priceGroup: 'CRYO' }, attachments: [{ file: 'file0', role: 'slip-page' }],
    })
    const part = init.body.get('file0')
    assert.ok(part instanceof Blob)
    assert.equal(await part.text(), 'photo bytes')
    assert.equal((part as File).name, 'slip.png')
    return jsonResponse(envelope)
  }
  assert.deepEqual(await callAiTask({ ...options, requestId: 'custom', getToken: async () => 'test-token', fetchImpl,
    files: [{ blob: new Blob(['photo bytes'], { type: 'image/png' }), filename: 'slip.png', role: 'slip-page' }],
  }), envelope)
})

test('no token means no Authorization; no files means JSON body', async () => {
  await callAiTask({ ...options, fetchImpl: async (_, init) => {
    assert.equal(new Headers(init?.headers).has('Authorization'), false)
    assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json')
    assert.deepEqual(JSON.parse(String(init?.body)), { input: { priceGroup: 'CRYO' } })
    return jsonResponse(successEnvelope())
  } })
})

for (const [status, code] of [[400, 'INVALID_INPUT'], [503, 'BUSY'], [401, 'UNAUTHORIZED']] as const) {
  test(`${status} ${code} preserves gateway error code and HTTP status`, async () => {
    await assert.rejects(callAiTask({ ...options, fetchImpl: async () => jsonResponse({
      ok: false, requestId: null, task: null, error: { code, message: 'Gateway message' },
    }, status) }), errorIs(code, status))
  })
}

for (const [name, response] of [
  ['non-JSON', () => new Response('<html>bad</html>')],
  ['missing result', () => jsonResponse({ ok: true })],
  ['unknown error code', () => jsonResponse({ ok: false, requestId: null, task: null, error: { code: 'ALIEN', message: 'bad' } })],
] as const) {
  test(`${name} is INVALID_RESPONSE`, async () => {
    await assert.rejects(callAiTask({ ...options, fetchImpl: async () => response() }), errorIs('INVALID_RESPONSE', 200))
  })
}

test('fetch rejection is NETWORK', async () => {
  await assert.rejects(callAiTask({ ...options, fetchImpl: async () => { throw new TypeError('offline') } }), errorIs('NETWORK'))
})

test('own deadline is CLIENT_TIMEOUT and aborts fetch', async () => {
  let signal: AbortSignal | null | undefined
  await assert.rejects(callAiTask({ ...options, timeoutMs: 10, fetchImpl: async (_, init) => {
    signal = init?.signal
    return new Promise<Response>(() => {})
  } }), errorIs('CLIENT_TIMEOUT'))
  assert.equal(signal?.aborted, true)
})

test('caller abort is ABORTED, including a pre-aborted caller', async () => {
  const controller = new AbortController()
  const pending = callAiTask({ ...options, signal: controller.signal, fetchImpl: async () => {
    controller.abort()
    throw new Error('aborted')
  } })
  await assert.rejects(pending, errorIs('ABORTED'))
  await assert.rejects(callAiTask({ ...options, signal: controller.signal, fetchImpl: async () => {
    assert.fail('pre-aborted call must not fetch')
  } }), errorIs('ABORTED'))
})

test('deadline covers token retrieval and response body parsing', async () => {
  await assert.rejects(callAiTask({ ...options, timeoutMs: 10, getToken: () => new Promise(() => {}),
    fetchImpl: async () => { assert.fail('must not fetch') },
  }), errorIs('CLIENT_TIMEOUT'))
  await assert.rejects(callAiTask({ ...options, timeoutMs: 10, fetchImpl: async () => ({
    ok: true, status: 200, json: () => new Promise(() => {}),
  } as unknown as Response) }), errorIs('CLIENT_TIMEOUT'))
})

test('empty base URL is NOT_CONFIGURED', async () => {
  await assert.rejects(callAiTask({ ...options, baseUrl: ' ', fetchImpl: async () => { assert.fail('must not fetch') } }), errorIs('NOT_CONFIGURED'))
})

test('health returns valid health or null for unreachable, malformed, non-2xx and timeout', async () => {
  const health = { ok: true, codexReady: true, busy: false, queued: 0 }
  assert.deepEqual(await checkAiGatewayHealth({ baseUrl: options.baseUrl, fetchImpl: async (url) => {
    assert.equal(url, 'http://stub.invalid/health')
    return jsonResponse(health)
  } }), health)
  for (const fetchImpl of [
    async () => { throw new Error('offline') }, async () => jsonResponse({ ok: true }),
    async () => jsonResponse(health, 503), async () => new Response('not json'),
    async () => new Promise<Response>(() => {}),
  ]) {
    assert.equal(await checkAiGatewayHealth({ baseUrl: options.baseUrl, fetchImpl, timeoutMs: 10 }), null)
  }
})
