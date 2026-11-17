import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', {
  namedExports: { aiGatewayBaseUrl: () => 'http://stub.invalid', aiGatewayToken: async () => null },
})

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value), removeItem: (key: string) => void storage.delete(key) },
  configurable: true,
})

interface FakeEvent {
  id: string
  at: string
  kind: 'staff' | 'agent' | 'action'
  speaker: { staffId: string, name: string } | null
  text: string
  images?: { id: string, name: string, type: string }[]
}
const server: { events: FakeEvent[], busy: boolean, posts: string[], failPost: boolean, imageRequests: string[], failImages: Set<string>, uploads: string[][], washingHistoryRequests: number } = {
  events: [], busy: false, posts: [], failPost: false, imageRequests: [], failImages: new Set(), uploads: [], washingHistoryRequests: 0,
}
const personalServer: Record<string, FakeEvent[]> = {}
const personalRequests: URL[] = []
const chatTargets: (string | null)[] = []
let counter = 0
function add(kind: 'staff' | 'agent' | 'action', text: string, extra: Partial<FakeEvent> = {}): FakeEvent {
  counter += 1
  const event: FakeEvent = { id: `e${counter}`, at: '2026-11-16 09:00:00', kind, speaker: kind === 'staff' ? { staffId: 'S1', name: 'Mali' } : null, text, ...extra }
  server.events.push(event)
  return event
}
const createdUrls = new Set<string>()
const revokedUrls = new Set<string>()
let urlCounter = 0
URL.createObjectURL = () => {
  const url = `blob:fake-${++urlCounter}`
  createdUrls.add(url)
  return url
}
URL.revokeObjectURL = (url: string) => void revokedUrls.add(url)

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.pathname === '/tasks/chat') {
    if (server.failPost) throw new Error('Offline')
    let message: string
    let images: FakeEvent['images']
    if (typeof init!.body === 'string') {
      const input = JSON.parse(init!.body).input
      message = input.message
      chatTargets.push(input.staffId ?? null)
    } else {
      const form = init!.body as FormData
      const request = JSON.parse(form.get('request') as string)
      message = request.input.message
      server.uploads.push(request.attachments.map((attachment: { file: string }) => (form.get(attachment.file) as File).name))
      images = request.attachments.map((_: unknown, index: number) => ({ id: `img-up-${index}`, name: `image-${index + 1}.jpg`, type: 'image/jpeg' }))
    }
    server.posts.push(message)
    const event = add('staff', message, images ? { images } : {})
    return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't', eventId: event.id } }, { status: 202 })
  }
  if (url.pathname.startsWith('/agents/appointments/images/')) {
    const id = url.pathname.split('/').pop()!
    server.imageRequests.push(id)
    if (server.failImages.has(id)) return Response.json({ ok: false, requestId: null, task: null, error: { code: 'NOT_FOUND', message: 'No image' } }, { status: 404 })
    return new Response(new Blob([id], { type: 'image/jpeg' }), { headers: { 'Content-Type': 'image/jpeg' } })
  }
  if (url.pathname === '/agents/personal/history') {
    personalRequests.push(url)
    const list = personalServer[url.searchParams.get('staffId') ?? ''] ?? []
    const limit = Number(url.searchParams.get('limit'))
    const after = url.searchParams.get('after')
    const before = url.searchParams.get('before')
    let slice: FakeEvent[]
    if (before !== null) {
      const index = list.findIndex(event => event.id === before)
      slice = list.slice(Math.max(0, index - limit), index)
    } else if (after !== null) {
      const start = list.findIndex(event => event.id === after) + 1
      slice = list.slice(start, start + limit)
    } else {
      slice = list.slice(Math.max(0, list.length - limit))
    }
    return Response.json({ events: slice, busy: false })
  }
  if (url.pathname === '/agents/washing/history') {
    server.washingHistoryRequests += 1
    return Response.json({ events: [], busy: false })
  }
  assert.equal(url.pathname, '/agents/appointments/history')
  const after = url.searchParams.get('after')
  const limit = Number(url.searchParams.get('limit'))
  const start = after === null ? Math.max(0, server.events.length - limit) : server.events.findIndex(event => event.id === after) + 1
  return Response.json({ events: server.events.slice(start, start + limit), busy: server.busy })
}

const { useTeamAgentStore } = await import('../../../../../src/data/team-agent/team-agent.store.ts')

try {
  add('staff', 'old 1')
  add('agent', 'old 2')
  setActivePinia(createPinia())
  const background = useTeamAgentStore('appointments')
  await background.refresh()
  assert.equal(background.unreadCount, 0)
  assert.equal(storage.get('team-agent-last-seen-event:appointments'), 'e2')
  add('agent', 'new 1')
  add('agent', 'new 2')
  await background.refresh()
  assert.equal(background.unreadCount, 2)

  await background.openChat()
  assert.deepEqual(background.events.map(event => event.id), ['e1', 'e2', 'e3', 'e4'])
  assert.equal(background.unreadCount, 0)
  assert.equal(storage.get('team-agent-last-seen-event:appointments'), 'e4')

  server.busy = true
  const accepted = await background.send('book Sam')
  assert.equal(accepted, true)
  assert.equal(background.pending.length, 0)
  assert.equal(background.events.at(-1)!.text, 'book Sam')
  assert.equal(background.events.filter(event => event.text === 'book Sam').length, 1)
  assert.equal(background.busy, true)

  add('agent', 'done')
  await Promise.all([background.refresh(), background.refresh()])
  assert.equal(background.events.at(-1)!.text, 'done')
  assert.equal(background.unreadCount, 0)

  server.failPost = true
  assert.equal(await background.send('lost'), false)
  assert.equal(background.pending.length, 0)
  assert.ok(background.sendError)

  const jpeg = (name: string) => ({ blob: new Blob([name], { type: 'image/jpeg' }), filename: name, url: URL.createObjectURL(new Blob([name])) })
  const withImages = [jpeg('image-1.jpg'), jpeg('image-2.jpg')]
  server.failPost = false
  assert.equal(await background.send('', withImages), true)
  assert.deepEqual(server.uploads, [['image-1.jpg', 'image-2.jpg']])
  assert.equal(background.pending.length, 0)
  for (const image of withImages) assert.ok(revokedUrls.has(image.url))
  const imageEvent = background.events.at(-1)!
  assert.deepEqual(imageEvent.images?.map(image => image.id), ['img-up-0', 'img-up-1'])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(server.imageRequests.sort(), ['img-up-0', 'img-up-1'])
  assert.equal(background.images['img-up-0']?.status, 'ready')
  const imageUrl = (background.images['img-up-0'] as { url: string }).url
  assert.ok(createdUrls.has(imageUrl))

  await background.refresh()
  await background.openChat()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(server.imageRequests.length, 2, 'reopening without a close reuses the cached images')

  server.failPost = true
  const failing = jpeg('failing.jpg')
  assert.equal(await background.send('lost images', [failing]), false)
  assert.ok(revokedUrls.has(failing.url))
  server.failPost = false

  add('agent', 'photo reply', { images: [{ id: 'img-bad', name: 'x.jpg', type: 'image/jpeg' }] })
  server.failImages.add('img-bad')
  await background.refresh()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(background.images['img-bad']?.status, 'failed')

  add('action', 'กำลังนัดหมาย', { id: 'action:a1:attempt' })
  add('action', 'กำลังนัดหมาย', { id: 'action:a2:attempt' })
  await background.refresh()
  assert.deepEqual(background.visibleEvents.filter(event => event.id.startsWith('action:')).map(event => event.id), ['action:a1:attempt', 'action:a2:attempt'])
  add('action', 'นัดหมายสำเร็จ', { id: 'action:a1:result' })
  add('action', 'ข้อความอื่น', { id: 'action:other' })
  await background.refresh()
  assert.deepEqual(background.visibleEvents.filter(event => event.id.startsWith('action:')).map(event => event.id), ['action:a2:attempt', 'action:a1:result', 'action:other'])
  assert.ok(background.events.some(event => event.id === 'action:a1:attempt'), 'raw events keep the attempt')

  const readyUrls = Object.values(background.images).flatMap(state => state.status === 'ready' ? [state.url] : [])
  assert.ok(readyUrls.length >= 2)
  background.closeChat()
  for (const url of readyUrls) assert.ok(revokedUrls.has(url))
  assert.deepEqual(background.images, {})
  add('agent', 'while away')
  await background.refresh()
  assert.equal(background.unreadCount, 1)

  storage.clear()
  server.events = []
  setActivePinia(createPinia())
  const fresh = useTeamAgentStore('appointments')
  await fresh.refresh()
  add('agent', 'first ever')
  await fresh.refresh()
  assert.equal(fresh.unreadCount, 1)

  // The old appointments key migrates once, so existing devices do not show everything unread.
  storage.clear()
  storage.set('appointments-agent-last-seen-event', 'e1')
  server.events = []
  add('agent', 'seen')
  add('agent', 'unseen')
  server.events[0]!.id = 'e1'
  setActivePinia(createPinia())
  const migrated = useTeamAgentStore('appointments')
  await migrated.refresh()
  assert.equal(migrated.unreadCount, 1)
  assert.equal(storage.get('team-agent-last-seen-event:appointments'), 'e1')
  assert.equal(storage.has('appointments-agent-last-seen-event'), false)

  // Each agent has its own state and endpoint.
  const washing = useTeamAgentStore('washing')
  assert.notEqual(washing, migrated)
  await washing.refresh()
  assert.equal(server.washingHistoryRequests, 1)
  assert.equal(washing.unreadCount, 0)
  assert.equal(storage.get('team-agent-last-seen-event:washing'), undefined)
  // Personal chats: keyed by target, last-seen key carries viewer and target, older events load by cursor.
  const personalEvent = (id: string): FakeEvent => ({ id, at: '2026-11-16 09:00:00', kind: 'agent', speaker: null, text: id })
  personalServer[''] = ['m1', 'm2'].map(personalEvent)
  personalServer.S2 = Array.from({ length: 250 }, (_, index) => personalEvent(`p${String(index + 1).padStart(3, '0')}`))
  storage.clear()
  setActivePinia(createPinia())
  const own = useTeamAgentStore('personal')
  const target = useTeamAgentStore('personal', 'S2')
  assert.notEqual(own, target)
  assert.equal(own.$id, 'team-agent-personal:self')
  assert.equal(target.$id, 'team-agent-personal:S2')
  assert.equal(useTeamAgentStore('personal', ''), own)
  assert.equal(useTeamAgentStore('washing', 'S2').$id, 'team-agent-washing')
  own.bindViewer('S1')
  target.bindViewer('S1')
  await own.refresh()
  assert.equal(storage.get('team-agent-last-seen-event:personal:S1:self'), 'm2')
  assert.equal(personalRequests.at(-1)!.searchParams.get('staffId'), null)

  await target.openChat()
  assert.equal(personalRequests.at(-1)!.searchParams.get('staffId'), 'S2')
  assert.equal(target.events.length, 200)
  assert.equal(target.hasOlder, true)
  assert.equal(storage.get('team-agent-last-seen-event:personal:S1:S2'), 'p250')
  assert.equal(storage.get('team-agent-last-seen-event:personal:S1:self'), 'm2', 'reading a target never moves the own marker')
  assert.equal(storage.has('team-agent-last-seen-event:personal:S2:self'), false)

  await target.loadOlder()
  const olderRequest = personalRequests.at(-1)!
  assert.equal(olderRequest.searchParams.get('before'), 'p051')
  assert.equal(olderRequest.searchParams.get('after'), null)
  assert.equal(olderRequest.searchParams.get('staffId'), 'S2')
  assert.equal(target.events.length, 250)
  assert.equal(target.events[0]!.id, 'p001')
  assert.equal(target.events.at(-1)!.id, 'p250')
  assert.equal(target.hasOlder, false)
  assert.equal(target.olderLoading, false)
  const requestsBefore = personalRequests.length
  await target.loadOlder()
  assert.equal(personalRequests.length, requestsBefore, 'nothing older: no request')

  await target.send('hello S2')
  assert.equal(chatTargets.at(-1), 'S2')
  await own.send('hello me')
  assert.equal(chatTargets.at(-1), null)

  // A new signed-in identity resets the personal stores and reads its own marker.
  storage.set('team-agent-last-seen-event:personal:S3:self', 'm1')
  own.bindViewer('S3')
  assert.equal(own.loaded, false)
  assert.equal(own.events.length, 0)
  assert.equal(own.unreadCount, 0)
  await own.refresh()
  assert.equal(own.unreadCount, 1)
  assert.equal(storage.get('team-agent-last-seen-event:personal:S1:self'), 'm2', 'the previous identity keeps its own marker')
  own.bindViewer('S3')
  assert.equal(own.unreadCount, 1, 'binding the same viewer again keeps state')

  // Existing agents ignore viewer binding.
  const appointments = useTeamAgentStore('appointments')
  const appointmentsUnread = appointments.unreadCount
  appointments.bindViewer('S9')
  assert.equal(appointments.unreadCount, appointmentsUnread)
  console.log('team-agent.store.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
