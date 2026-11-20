import { fetchPushKey, subscribePush, unsubscribePush } from './team-agent.service'

let workerRegistration: Promise<ServiceWorkerRegistration | undefined> | undefined
let enabling: AbortController | undefined

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function needsHomeScreen(): boolean {
  if (typeof window === 'undefined') return false
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  return appleMobile && (navigator as Navigator & { standalone?: boolean }).standalone !== true
    && !window.matchMedia('(display-mode: standalone)').matches
}

export function registerServiceWorker(): void {
  if (!pushSupported()) return
  workerRegistration ??= Promise.resolve().then(() => navigator.serviceWorker.register('/sw.js')).catch(reason => {
    console.warn('Push service worker registration failed', reason)
    return undefined
  })
}

export function decodeVapidKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), char => char.charCodeAt(0))
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const registration = await workerRegistration
  return Boolean(await registration?.pushManager.getSubscription())
}

export async function enablePush(): Promise<NotificationPermission> {
  const controller = new AbortController()
  enabling = controller
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission
    controller.signal.throwIfAborted()
    if (!await workerRegistration) throw new Error('Push service worker is unavailable')
    const publicKey = await fetchPushKey(controller.signal)
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    controller.signal.throwIfAborted()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    })
    try {
      await subscribePush(subscription.toJSON(), controller.signal)
    } catch (reason) {
      if (!existing) await subscription.unsubscribe().catch(() => {})
      throw reason
    }
    return permission
  } finally {
    if (enabling === controller) enabling = undefined
  }
}

export async function syncPush(signal?: AbortSignal): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  try {
    const registration = await workerRegistration
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) await subscribePush(subscription.toJSON(), signal)
  } catch {}
}

export async function disablePushForSignOut(): Promise<void> {
  enabling?.abort()
  if (!pushSupported()) return
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) return
    try {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        try { await unsubscribePush(subscription.endpoint) } catch {}
        await subscription.unsubscribe()
      }
    } finally {
      const notifications = await registration.getNotifications()
      notifications.forEach(notification => notification.close())
    }
  } catch {}
}
