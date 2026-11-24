import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const auth = reactive({ status: 'signedIn', role: 'staff', staff: { staffId: 'S1' } as { staffId: string } | null })
mock.module('../../../../../src/data/auth/auth.store.ts', { namedExports: { useAuthStore: () => auth } })
mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', { namedExports: { aiGatewayBaseUrl: () => 'https://gateway.invalid', aiGatewayToken: async () => 'token' } })
const { usePreferencesStore } = await import('@/data/preferences/preferences.store')
let deferred: ((response: Response) => void) | null = null
let deferNext = false
let fail = false
const previousFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  assert.equal(url.pathname, '/preferences')
  if (deferNext) { deferNext = false; return new Promise<Response>(resolve => { deferred = resolve }) }
  if (fail) return Response.json({ error: 'offline' }, { status: 500 })
  const body = init?.method === 'POST' ? JSON.parse(String(init.body)) : null
  return Response.json({ staffId: body?.staffId ?? url.searchParams.get('staffId'), language: body?.language ?? 'th' })
}
try {
  setActivePinia(createPinia())
  const store = usePreferencesStore()
  await store.load('S1')
  assert.equal(store.preferences?.language, 'th')
  await store.update('S1', 'my')
  assert.equal(store.preferences?.language, 'my')
  deferNext = true
  const old = store.load('S1')
  await new Promise(resolve => setImmediate(resolve))
  await store.load('S2')
  deferred!(Response.json({ staffId: 'S1', language: 'en' }))
  assert.equal(await old, null)
  assert.equal(store.preferences?.staffId, 'S2')
  deferNext = true
  const pending = store.load('S1')
  await new Promise(resolve => setImmediate(resolve))
  auth.staff = null
  deferred!(Response.json({ staffId: 'S1', language: 'en' }))
  assert.equal(await pending, null)
  assert.equal(store.preferences, null)
  assert.equal(store.loading, false)
  fail = true
  await assert.rejects(store.update('S1', 'my'))
  assert.ok(store.error)
  store.$dispose()
} finally { globalThis.fetch = previousFetch }
console.log('preferences store and service dry test passed')
