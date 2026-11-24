import assert from 'node:assert/strict'
import * as chat from '../../../shared/ai-gateway/tasks/direct-chat.js'
import { getStaffPreferences, updateStaffPreferences } from '../../../shared/ai-gateway/tasks/preferences.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'

const id = 'dm_' + 'a'.repeat(24)
const peer = { staffId: 'S2', name: 'Peer' }
const message = { seq: 1, id: '1', at: '2026-11-24T01:00:00.000Z', kind: 'staff', speaker: { ...peer, role: 'staff' }, text: 'Hello', clientId: 'uuid-1', translate: { state: 'pending', to: 'my' } }
const calls: { path: string, init?: RequestInit }[] = []
let response: unknown
const access = { baseUrl: 'https://gateway.invalid/', getToken: async () => 'token', fetchImpl: (async (url, init) => {
  calls.push({ path: String(url).replace('https://gateway.invalid', ''), init })
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token')
  return Response.json(response)
}) as typeof fetch }
response = { conversations: [{ conversationId: id, peer, last: { seq: 1, at: message.at, speakerId: 'S2', text: 'Hello', hasImages: false }, unread: 2 }] }
assert.equal((await chat.getDirectChatInbox(access)).conversations[0].unread, 2)
assert.equal(calls.at(-1)?.path, '/direct/inbox')
response = { conversationId: id, peer }
await chat.createDirectChatConversation(access, 'S2')
assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { peerStaffId: 'S2' })
response = { conversationId: id, peer, messages: [message], highWater: 3, hasMore: true, readSeq: 0 }
assert.equal((await chat.getDirectChatHistory(access, id, { before: 4, limit: 1 })).highWater, 3)
assert.equal(calls.at(-1)?.path, `/direct/conversations/${id}/history?before=4&limit=1`)
response = { messages: [], translationUpdates: [{ seq: 3, kind: 'translation', refSeq: 1, lang: 'my', same: true }], nextAfter: 3, hasMore: false }
assert.equal((await chat.getDirectChatAfter(access, id, 1)).translationUpdates[0].same, true)
assert.equal(calls.at(-1)?.path, `/direct/conversations/${id}/history?after=1`)
response = { message }
await chat.sendDirectChatMessage(access, id, { text: 'Hello', clientId: 'uuid-1' })
assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { text: 'Hello', clientId: 'uuid-1' })
assert.equal(new Headers(calls.at(-1)?.init?.headers).get('Content-Type'), 'application/json')
const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
await chat.sendDirectChatMessage(access, id, { text: '', clientId: 'uuid-1' }, [file])
const multipart = calls.at(-1)!.init!.body as FormData
assert.equal(new Headers(calls.at(-1)?.init?.headers).get('Content-Type'), null)
assert.deepEqual(JSON.parse(String(multipart.get('request'))), { text: '', clientId: 'uuid-1' })
assert.deepEqual([...multipart.keys()], ['request', 'images'])
assert.equal((multipart.get('images') as File).name, 'photo.jpg')
response = { readSeq: 1 }
await chat.markDirectChatRead(access, id, '1')
assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { eventId: '1' })
for (const state of ['pending', 'done', 'unavailable', 'off']) {
  response = { translate: { state, to: 'my', text: 'translated', same: false } }
  assert.equal((await chat.retryDirectChatTranslation(access, id, 1)).translate.state, state)
  assert.equal(calls.at(-1)?.path, `/direct/conversations/${id}/messages/1/translate`)
}
const image = await chat.getDirectChatImage({ ...access, fetchImpl: (async (url) => {
  assert.equal(String(url), `https://gateway.invalid/direct/conversations/${id}/images/photo.jpg`)
  return new Response('bytes', { headers: { 'Content-Type': 'image/jpeg' } })
}) as typeof fetch }, id, 'photo.jpg')
assert.equal(await image.text(), 'bytes')
response = { staffId: 'S1', language: 'th' }
await getStaffPreferences(access, 'S1')
assert.equal(calls.at(-1)?.path, '/preferences?staffId=S1')
response = { staffId: 'S1', language: 'my' }
await updateStaffPreferences(access, 'S1', 'my')
assert.equal(calls.at(-1)?.path, '/preferences')
assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { staffId: 'S1', language: 'my' })
response = { staffId: 'other', language: 'my' }
await assert.rejects(getStaffPreferences(access, 'S1'), (e: unknown) => e instanceof AiGatewayError && e.code === 'INVALID_RESPONSE')
const count = calls.length
assert.throws(() => chat.getDirectChatAfter(access, '../escape', 0))
assert.throws(() => chat.getDirectChatAfter(access, id, -1))
assert.throws(() => chat.sendDirectChatMessage(access, id, { text: '', clientId: 'id' }))
assert.throws(() => chat.sendDirectChatMessage(access, id, { text: '\ud800', clientId: 'id' }))
assert.throws(() => chat.sendDirectChatMessage(access, id, { text: 'ok', clientId: 'id' }, [file, file, file, file]))
assert.equal(calls.length, count)
response = { conversations: [] }
await assert.rejects(chat.getDirectChatAfter(access, id, 0))
response = { conversationId: 'dm_' + 'b'.repeat(24), peer, messages: [], highWater: 0, hasMore: false, readSeq: 0 }
await assert.rejects(chat.getDirectChatHistory(access, id))
assert.equal(chat.directChatTranslationSchema.safeParse({ state: 'ready', to: 'my' }).success, false)
console.log('direct chat and preferences contracts dry test passed')
