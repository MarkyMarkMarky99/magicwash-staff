import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

let baseUrl = 'https://gateway.invalid/'
mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', {
  namedExports: { aiGatewayBaseUrl: () => baseUrl, aiGatewayToken: async () => 'firebase-token' },
})
const { useSecretarySettingsStore } = await import('@/data/team-agent/secretary-settings.store')
let response: (value: Response) => void = () => {}
let deferred = false
let fail = false
let calls = 0
const previousFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  calls++
  const url = new URL(String(input))
  assert.ok(['/secretary/settings', '/preferences'].includes(url.pathname))
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer firebase-token')
  if (deferred && url.pathname === '/preferences') return new Promise<Response>(resolve => { response = resolve })
  if (fail) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const body = init?.method === 'POST' ? JSON.parse(String(init.body)) : null
  const language = body?.language ?? 'th'
  if (init?.method === 'POST') {
    assert.equal(url.pathname, '/preferences')
    assert.deepEqual(Object.keys(body), ['staffId', 'language'])
  }
  return Response.json({ staffId: body?.staffId ?? url.searchParams.get('staffId'), language, ...(url.pathname === '/secretary/settings' ? { codexReady: true } : {}) })
}
try {
  setActivePinia(createPinia())
  const store = useSecretarySettingsStore()
  await store.load('owner')
  assert.equal(store.settings?.language, 'th')
  await store.update('owner', { language: 'my' })
  assert.equal(store.settings?.language, 'my')
  assert.equal(store.settings?.codexReady, true)
  deferred = true
  const old = store.load('old')
  assert.equal(store.loading, true)
  assert.equal(store.settings, null)
  await new Promise(resolve => setImmediate(resolve))
  deferred = false
  await store.load('new')
  response(Response.json({ staffId: 'old', language: 'en', codexReady: false }))
  await old
  assert.equal(store.settings?.staffId, 'new')
  deferred = true
  const pending = store.load('owner')
  await new Promise(resolve => setImmediate(resolve))
  store.reset()
  response(Response.json({ staffId: 'owner', language: 'th', codexReady: true }))
  await pending
  assert.equal(store.settings, null)
  assert.equal(store.loading, false)
  deferred = false
  fail = true
  await assert.rejects(store.load('owner'))
  assert.ok(store.error)
  assert.equal(store.settings, null)
  const before = calls
  baseUrl = ''
  await assert.rejects(store.load('owner'))
  assert.equal(calls, before)
  store.reset()
  store.$dispose()
} finally {
  globalThis.fetch = previousFetch
}
console.log('secretary settings store and service dry test passed')
