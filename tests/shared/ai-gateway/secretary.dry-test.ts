import assert from 'node:assert/strict'
import { getSecretarySettings, putSecretarySettings } from '../../../shared/ai-gateway/tasks/secretary.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'

let calls = 0
let result: unknown = { staffId: 'staff /1', language: 'th', codexReady: false }
let status = 200
const access = { baseUrl: 'https://gateway.invalid/secretary/', staffId: 'staff /1', getToken: async () => 'firebase-token',
  fetchImpl: (async (url, init) => {
    calls++
    assert.equal(String(url), 'https://gateway.invalid/secretary/settings?staffId=staff+%2F1')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer firebase-token')
    if (init?.method === 'POST') {
      assert.equal(new Headers(init.headers).get('Content-Type'), 'application/json')
      const body = JSON.parse(String(init.body))
      assert.deepEqual(Object.keys(body), ['language'])
      result = { staffId: 'staff /1', language: body.language, codexReady: true }
    } else {
      assert.equal(init?.method, 'GET')
      assert.equal(init?.body, undefined)
    }
    return Response.json(result, { status })
  }) as typeof fetch }
assert.deepEqual(await getSecretarySettings(access), result)
for (const language of ['th', 'my', 'en'] as const) {
  assert.deepEqual(await putSecretarySettings({ ...access, body: { language } }), { staffId: 'staff /1', language, codexReady: true })
}
const before = calls
for (const input of [{ staffId: '' }, { body: { language: 'jp' } }, { body: { language: 'en', codexReady: true } }]) {
  assert.throws(() => putSecretarySettings({ ...access, body: { language: 'en' }, ...input } as Parameters<typeof putSecretarySettings>[0]),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_INPUT')
}
assert.equal(calls, before)
for (const invalid of [{ staffId: 'other', language: 'en', codexReady: true }, { staffId: access.staffId, language: 'jp', codexReady: true }, { staffId: access.staffId, language: 'en' }]) {
  result = invalid
  await assert.rejects(getSecretarySettings(access), (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_RESPONSE')
}
for (const rejected of [401, 403, 500]) {
  status = rejected
  result = { error: 'Rejected' }
  await assert.rejects(getSecretarySettings(access), (error: unknown) => error instanceof AiGatewayError && error.status === rejected)
}
console.log('secretary settings gateway dry test passed')
