self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload
  try {
    payload = event.data?.json()
  } catch {}

  event.waitUntil(self.registration.showNotification(
    typeof payload?.title === 'string' && payload.title ? payload.title : 'Magicwash',
    {
      body: typeof payload?.body === 'string' ? payload.body : '',
      tag: typeof payload?.tag === 'string' ? payload.tag : undefined,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload?.url },
    },
  ))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(openChat(event.notification.data?.url))
})

async function openChat(path) {
  const fallback = new URL('/#/agents', self.location.origin)
  let url = fallback
  if (typeof path === 'string') {
    try {
      const target = new URL(path, fallback)
      if (target.origin === fallback.origin && target.pathname === '/' && target.hash.startsWith('#/agents/')) url = target
    } catch {}
  }

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find(client => new URL(client.url).origin === fallback.origin)
  if (existing) {
    try {
      await existing.focus()
      if (await existing.navigate(url.href)) return
    } catch {}
  }
  await self.clients.openWindow(url.href)
}
