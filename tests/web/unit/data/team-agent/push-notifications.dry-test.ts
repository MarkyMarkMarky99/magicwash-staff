import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createPinia, disposePinia, setActivePinia } from 'pinia'

mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', {
  namedExports: { aiGatewayBaseUrl: () => 'https://gateway.invalid', aiGatewayToken: async () => 'firebase-token' },
})

const {
  decodeVapidKey, disablePushForSignOut, enablePush, hasActivePushSubscription,
  needsHomeScreen, pushSupported, registerServiceWorker, syncPush,
} = await import('../../../../../src/data/team-agent/push-notifications.ts')

assert.deepEqual(decodeVapidKey('-_8'), new Uint8Array([251, 255]))
assert.deepEqual(decodeVapidKey('-_8='), new Uint8Array([251, 255]))

const calls: string[] = []
const subscriptionJson = { endpoint: 'https://push.invalid/id', keys: { auth: 'auth', p256dh: 'key' } }
const subscription = {
  endpoint: subscriptionJson.endpoint,
  toJSON: () => subscriptionJson,
  unsubscribe: async () => {
    calls.push('local unsubscribe')
    activeSubscription = null
    return true
  },
}
let activeSubscription: typeof subscription | null = null
let permission: NotificationPermission = 'default'
let permissionResult: NotificationPermission = 'denied'
const registration = {
  pushManager: {
    getSubscription: async () => activeSubscription,
    subscribe: async (options: PushSubscriptionOptionsInit) => {
      calls.push('local subscribe')
      assert.deepEqual(options, { userVisibleOnly: true, applicationServerKey: new Uint8Array([251, 255]) })
      activeSubscription = subscription
      return subscription
    },
  },
  getNotifications: async () => [{ close: () => calls.push('close notification') }],
}
const navigatorMock = {
  userAgent: 'iPhone',
  maxTouchPoints: 1,
  standalone: false,
  serviceWorker: {
    register: async (path: string) => {
      calls.push('register ' + path)
      return registration
    },
    get ready() {
      calls.push('worker ready')
      return Promise.resolve(registration)
    },
    getRegistration: async () => registration,
  },
}
let displayModeStandalone = false
const windowMock = {
  PushManager: {},
  Notification: {
    get permission() { return permission },
    requestPermission: async () => {
      calls.push('request permission')
      permission = permissionResult
      return permission
    },
  },
  matchMedia: (query: string) => {
    assert.equal(query, '(display-mode: standalone)')
    return { matches: displayModeStandalone }
  },
}
Object.defineProperty(globalThis, 'navigator', { value: navigatorMock, configurable: true })
Object.assign(globalThis, { window: windowMock, Notification: windowMock.Notification })

assert.equal(pushSupported(), true)
assert.equal(needsHomeScreen(), true)
navigatorMock.standalone = true
assert.equal(needsHomeScreen(), false)
navigatorMock.standalone = false
navigatorMock.userAgent = 'Macintosh'
assert.equal(needsHomeScreen(), false)
navigatorMock.maxTouchPoints = 5
assert.equal(needsHomeScreen(), true)
displayModeStandalone = true
assert.equal(needsHomeScreen(), false)
displayModeStandalone = false
navigatorMock.userAgent = 'Android'
assert.equal(needsHomeScreen(), false)

let rejectUnsubscribe = false
globalThis.fetch = async (input, init) => {
  const path = new URL(String(input)).pathname
  calls.push([init?.method, path].join(' '))
  const headers = new Headers(init?.headers)
  assert.equal(headers.get('Authorization'), 'Bearer firebase-token')
  if (path === '/agents/push/key') {
    assert.equal(init?.body, undefined)
  } else {
    assert.equal(headers.get('Content-Type'), 'application/json')
    assert.deepEqual(JSON.parse(String(init?.body)), path === '/agents/push/subscribe'
      ? { subscription: subscriptionJson }
      : { endpoint: subscription.endpoint })
  }
  if (path === '/agents/push/unsubscribe' && rejectUnsubscribe) throw new Error('offline')
  const result = path === '/agents/push/key' ? { publicKey: '-_8' } : {}
  return Response.json({ ok: true, requestId: 'r', task: 'push', taskVersion: 1, ms: 1, result })
}

registerServiceWorker()
registerServiceWorker()
await Promise.resolve()
assert.deepEqual(calls.splice(0), ['register /sw.js'])

assert.equal(await enablePush(), 'denied')
assert.deepEqual(calls.splice(0), ['request permission'])
assert.equal(await hasActivePushSubscription(), false)

permissionResult = 'granted'
assert.equal(await enablePush(), 'granted')
assert.equal(await hasActivePushSubscription(), true)
assert.deepEqual(calls.splice(0), [
  'request permission', 'GET /agents/push/key', 'worker ready', 'local subscribe', 'POST /agents/push/subscribe',
])

await syncPush()
assert.deepEqual(calls.splice(0), ['POST /agents/push/subscribe'])

await disablePushForSignOut()
assert.deepEqual(calls.splice(0), ['POST /agents/push/unsubscribe', 'local unsubscribe', 'close notification'])
assert.equal(await hasActivePushSubscription(), false)

activeSubscription = subscription
rejectUnsubscribe = true
await disablePushForSignOut()
assert.deepEqual(calls.splice(0), ['POST /agents/push/unsubscribe', 'local unsubscribe', 'close notification'])

type FirebaseUser = { uid: string, email: string }
let changeUser: (user: FirebaseUser | null) => void = () => {}
let role = 'staff'
mock.module('../../../../../src/shared/api/firebase-auth.ts', {
  namedExports: {
    onUserChanged: (callback: typeof changeUser) => { changeUser = callback },
    completeRedirectSignIn: async () => {},
    signInWithGoogle: async () => {},
    signInWithGoogleRedirect: async () => {},
    signOutUser: async () => {
      calls.push('Firebase sign-out')
      changeUser(null)
    },
    authFetch: globalThis.fetch,
  },
})
mock.module('../../../../../src/data/auth/auth.service.ts', {
  namedExports: { getCurrentStaff: async () => ({ staffId: 'staff-id', role }) },
})

const { useAuthStore } = await import('../../../../../src/data/auth/auth.store.ts')
const pinia = createPinia()
setActivePinia(pinia)
try {
  const authStore = useAuthStore()
  const ready = authStore.ready()
  activeSubscription = subscription
  changeUser({ uid: 'staff-one', email: 'staff@example.test' })
  await ready
  await nextTurn()
  assert.deepEqual(calls.splice(0), ['POST /agents/push/subscribe'])

  await authStore.recheck()
  await nextTurn()
  assert.deepEqual(calls, [])

  changeUser({ uid: 'staff-two', email: 'other-staff@example.test' })
  await nextTurn()
  assert.deepEqual(calls.splice(0), ['POST /agents/push/subscribe'])
  await authStore.signOut()
  assert.deepEqual(calls.splice(0), [
    'POST /agents/push/unsubscribe', 'local unsubscribe', 'close notification', 'Firebase sign-out',
  ])

  activeSubscription = subscription
  role = 'device'
  changeUser({ uid: 'device', email: 'device@example.test' })
  await nextTurn()
  assert.equal(authStore.role, 'device')
  assert.deepEqual(calls, [])
} finally {
  disposePinia(pinia)
}

console.log('Push notifications dry tests passed')
