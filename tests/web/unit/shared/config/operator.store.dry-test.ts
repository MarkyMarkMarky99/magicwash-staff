import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/data/auth/auth.store'
import { useOperatorStore } from '@/data/operator/operator.store'
import { currentActor, currentOperatorId, setSignedInStaffId } from '@/shared/config/actor'
import { authFetch } from '@/shared/api/firebase-auth'

const HOUR = 3_600_000

test('operator replaces on scan, persists, mirrors synchronously, expires at one hour and clears', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: 10_000_000 })
  const values = new Map<string, string>()
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  let reply: { staffId: string; name: string } = { staffId: 'first', name: 'First' }
  let status = 200
  let lastHeaders = new Headers()
  t.mock.method(globalThis, 'fetch', async (_input: string, init?: RequestInit) => {
    lastHeaders = new Headers(init?.headers)
    return Response.json(status === 404 ? { success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } } : { success: true, data: reply }, { status })
  })
  setSignedInStaffId('device')
  setActivePinia(createPinia())
  let store = useOperatorStore()
  try {
    await store.scanCard('MWS-first')
    assert.equal(currentActor(), 'first')
    assert.equal(store.scannedAt, Date.now())
    assert.equal(values.size, 1)
    await authFetch('/api/example')
    assert.equal(lastHeaders.get('X-Operator-Id'), 'first')
    t.mock.timers.tick(HOUR - 1)
    assert.equal(store.staffId, 'first')
    t.mock.timers.tick(1)
    assert.equal(store.staffId, null)
    assert.equal(currentActor(), 'device')
    assert.equal(values.size, 0)

    await store.scanCard('MWS-first')
    t.mock.timers.tick(HOUR / 2)
    reply = { staffId: 'second', name: 'Second' }
    await store.scanCard('MWS-second')
    assert.equal(store.staffId, 'second')
    assert.equal(store.name, 'Second')
    assert.equal(currentOperatorId(), 'second')
    const persisted = [...values.values()][0]!
    t.mock.timers.tick(HOUR / 2)
    assert.equal(store.staffId, 'second')
    store.$dispose()
    setActivePinia(createPinia())
    store = useOperatorStore()
    assert.equal(store.staffId, 'second')
    assert.equal(currentActor(), 'second')
    t.mock.timers.tick(HOUR / 2)
    assert.equal(store.staffId, null)

    values.set('staff-operator', persisted)
    store.$dispose()
    setActivePinia(createPinia())
    store = useOperatorStore()
    assert.equal(store.staffId, null, 'expired persisted operator is rejected on load')
    status = 404
    await store.scanCard('MWS-missing')
    assert.equal(store.notice, 'ไม่พบบัตรพนักงานนี้')
    status = 200
    await store.scanCard('MWS-second')
    const authStore = useAuthStore()
    authStore.staff = { staffId: 'device', name: 'Shop', email: 'shop@test', role: 'device' }
    authStore.status = 'signedIn'
    assert.equal(authStore.isAdmin, false)
    await authStore.signOut()
    assert.equal(currentOperatorId(), null)
    assert.equal(currentActor(), 'device')
    await authFetch('/api/example')
    assert.equal(lastHeaders.has('X-Operator-Id'), false)
  } finally {
    store.clear()
    store.$dispose()
    setSignedInStaffId(null)
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
