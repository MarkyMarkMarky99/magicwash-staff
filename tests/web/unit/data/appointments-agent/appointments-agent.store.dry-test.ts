import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', {
  namedExports: { aiGatewayBaseUrl: () => 'http://stub.invalid', aiGatewayToken: async () => null },
})

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
  configurable: true,
})

interface FakeEvent { id: string, at: string, kind: 'staff' | 'agent', speaker: { staffId: string, name: string } | null, text: string }
const server: { events: FakeEvent[], busy: boolean, posts: string[], failPost: boolean } = { events: [], busy: false, posts: [], failPost: false }
let counter = 0
function add(kind: 'staff' | 'agent', text: string): FakeEvent {
  counter += 1
  const event = { id: `e${counter}`, at: '2026-11-16 09:00:00', kind, speaker: kind === 'staff' ? { staffId: 'S1', name: 'Mali' } : null, text }
  server.events.push(event)
  return event
}

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.pathname === '/tasks/chat') {
    if (server.failPost) throw new Error('Offline')
    const { message } = JSON.parse(init!.body as string).input
    server.posts.push(message)
    const event = add('staff', message)
    return Response.json({ ok: true, requestId: 'r', task: 'chat', taskVersion: 1, ms: 1, result: { accepted: true, turnId: 't', eventId: event.id } }, { status: 202 })
  }
  assert.equal(url.pathname, '/agents/appointments/history')
  const after = url.searchParams.get('after')
  const limit = Number(url.searchParams.get('limit'))
  const start = after === null ? Math.max(0, server.events.length - limit) : server.events.findIndex(event => event.id === after) + 1
  return Response.json({ events: server.events.slice(start, start + limit), busy: server.busy })
}

const { useAppointmentsAgentStore } = await import('../../../../../src/data/appointments-agent/appointments-agent.store.ts')

try {
  add('staff', 'old 1')
  add('agent', 'old 2')
  setActivePinia(createPinia())
  const background = useAppointmentsAgentStore()
  await background.refresh()
  assert.equal(background.unreadCount, 0)
  assert.equal(storage.get('appointments-agent-last-seen-event'), 'e2')
  add('agent', 'new 1')
  add('agent', 'new 2')
  await background.refresh()
  assert.equal(background.unreadCount, 2)

  await background.openChat()
  assert.deepEqual(background.events.map(event => event.id), ['e1', 'e2', 'e3', 'e4'])
  assert.equal(background.unreadCount, 0)
  assert.equal(storage.get('appointments-agent-last-seen-event'), 'e4')

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

  background.closeChat()
  add('agent', 'while away')
  await background.refresh()
  assert.equal(background.unreadCount, 1)

  storage.clear()
  server.events = []
  setActivePinia(createPinia())
  const fresh = useAppointmentsAgentStore()
  await fresh.refresh()
  add('agent', 'first ever')
  await fresh.refresh()
  assert.equal(fresh.unreadCount, 1)
  console.log('appointments-agent.store.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
