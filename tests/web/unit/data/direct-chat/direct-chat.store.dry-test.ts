import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { reactive, effectScope, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type * as Service from '../../../../../src/data/direct-chat/direct-chat.service'
import type { DirectChatMessage } from '../../../../../src/data/direct-chat/direct-chat.service'

const auth = reactive({ status: 'signedIn', role: 'staff', staff: { staffId: 'S1' } as { staffId: string } | null })
mock.module('../../../../../src/data/auth/auth.store.ts', { namedExports: { useAuthStore: () => auth } })
mock.module('../../../../../src/shared/ai-gateway/ai-gateway.config.ts', { namedExports: { aiGatewayBaseUrl: () => 'https://gateway.invalid', aiGatewayToken: async () => 'token' } })
const { createDirectChatState, useDirectChatStore } = await import('@/data/direct-chat/direct-chat.store')
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const a = 'dm_' + 'a'.repeat(24), b = 'dm_' + 'b'.repeat(24)
const peer = { staffId: 'S2', name: 'Peer' }
const message = (seq: number, sender = 'S2'): DirectChatMessage => ({ seq, id: String(seq), kind: 'staff', at: '2026-11-24T00:00:00.000Z', speaker: { staffId: sender, name: sender, role: 'staff' }, text: 'hello', clientId: `client-${seq}`, translate: { to: 'my', state: 'pending' } })
const history = (id = a, messages = [message(3)]) => ({ conversationId: id, peer, messages, highWater: 5, readSeq: 0, hasMore: true })
const row = (unread: number) => ({ conversationId: a, peer, last: { seq: 3, at: '', speakerId: 'S2', text: '', hasImages: false }, unread })
let historyCall: typeof Service.fetchHistory = async id => history(id)
let afterCall: typeof Service.fetchAfter = async (_id, after) => ({ messages: [], translationUpdates: [], nextAfter: after, hasMore: false })
let inboxCall: typeof Service.fetchInbox = async () => ({ conversations: [row(3)] })
let imageCall: typeof Service.fetchImage = async () => new Blob(['image'])
let sendCall: typeof Service.sendMessage = async () => ({ message: message(8, 'S1') })
let reads = 0
const api: typeof Service = {
  fetchHistory: (...args) => historyCall(...args), fetchAfter: (...args) => afterCall(...args),
  fetchInbox: () => inboxCall(), fetchImage: (...args) => imageCall(...args), sendMessage: (...args) => sendCall(...args),
  createConversation: async () => ({ conversationId: a, peer }),
  markRead: async (_id, eventId) => { reads++; return { readSeq: Number(eventId) } },
  retryTranslation: async () => ({ translate: { to: 'my', state: 'pending' } }),
}
const state = createDirectChatState(api)
state.bindSession('S1', 1)
await state.openThread(a)
assert.equal(state.nextAfter.value, 5)
assert.equal(reads, 0)
const cursors: number[] = []
afterCall = async (_id, after) => {
  cursors.push(after)
  return after === 5 ? { messages: [message(6)], translationUpdates: [], nextAfter: 6, hasMore: true }
    : { messages: [], translationUpdates: [{ seq: 7, kind: 'translation', refSeq: 3, lang: 'my', text: 'translated' }], nextAfter: 7, hasMore: false }
}
await state.pollThread()
assert.deepEqual(cursors, [5, 6])
assert.equal(state.nextAfter.value, 7)
assert.equal(state.messages.value[0].translate?.text, 'translated')
assert.equal(reads, 0)
historyCall = async (_id, options) => { assert.equal(options?.before, 3); return { ...history(a, [message(1)]), hasMore: false } }
await state.loadOlder()
assert.deepEqual(state.messages.value.map(m => m.seq), [1, 3, 6])
assert.equal(state.nextAfter.value, 7)
assert.equal(state.hasOlder.value, false)
state.setThreadVisible(true)
await state.markVisiblePeerRead(3)
assert.equal(reads, 1)
assert.equal(state.readSeq.value, 3)
await state.markVisiblePeerRead(2)
assert.equal(reads, 1)
state.setThreadVisible(false)
await state.markVisiblePeerRead(6)
assert.equal(reads, 1)
afterCall = async (_id, cursor) => ({ messages: [], translationUpdates: [
  { seq: cursor + 1, kind: 'translation', refSeq: 3, lang: 'my', same: true },
  { seq: cursor + 2, kind: 'translation', refSeq: 6, lang: 'th', error: 'failed' },
], nextAfter: cursor + 2, hasMore: false })
await state.pollThread()
assert.equal(state.messages.value.find(m => m.seq === 3)?.translate?.same, true)
assert.equal(state.messages.value.find(m => m.seq === 6)?.translate?.state, 'unavailable')
await state.retryTranslation(6)
assert.equal(state.messages.value.find(m => m.seq === 6)?.translate?.state, 'pending')
// A -> B -> A must reject the first A's history and translation replies.
const oldHistory = deferred<Awaited<ReturnType<typeof Service.fetchHistory>>>()
historyCall = () => oldHistory.promise
const opening = state.openThread(a)
historyCall = async id => history(id)
await state.openThread(b)
await state.openThread(a)
oldHistory.resolve(history(a, [message(99)]))
await opening
assert.deepEqual(state.messages.value.map(m => m.seq), [3])
const oldAfter = deferred<Awaited<ReturnType<typeof Service.fetchAfter>>>()
afterCall = () => oldAfter.promise
const polling = state.pollThread()
await state.openThread(b); await state.openThread(a)
oldAfter.resolve({ messages: [message(99)], translationUpdates: [], nextAfter: 99, hasMore: false })
await polling
assert.equal(state.nextAfter.value, 5)
// Inbox invalidation during a request drains again, without publishing its obsolete snapshot.
const firstInbox = deferred<Awaited<ReturnType<typeof Service.fetchInbox>>>()
let inboxCalls = 0
inboxCall = () => { inboxCalls++; return inboxCalls === 1 ? firstInbox.promise : Promise.resolve({ conversations: [row(8)] }) }
const refreshing = state.refreshInbox()
assert.equal(state.refreshInbox(), refreshing)
const invalidated = state.invalidateInbox()
assert.equal(inboxCalls, 1)
firstInbox.resolve({ conversations: [row(99)] })
await Promise.all([refreshing, invalidated])
assert.equal(inboxCalls, 2)
assert.equal(state.unreadTotal.value, 8)
// Retrying reuses the exact prepared bytes and UUID.
const file = new File(['prepared'], 'photo.jpg', { type: 'image/jpeg' })
const attempts: { body: Service.DirectChatSend, files: File[] }[] = []
sendCall = async (_id, body, files = []) => { attempts.push({ body, files }); if (attempts.length === 1) throw new Error('lost acknowledgement'); return { message: message(8, 'S1') } }
await assert.rejects(state.send('unchanged', [file], { prepared: true }))
const pending = state.pendingSend.value!
assert.match(pending.clientId, /^[0-9a-f-]{36}$/)
await state.retrySend()
assert.deepEqual(attempts[0].body, attempts[1].body)
assert.equal(attempts[0].files, attempts[1].files)
assert.equal(attempts[0].files[0], file)
assert.equal(state.pendingSend.value, null)
// Preparation completion after A -> B -> A cannot post or create a draft.
const preparation = deferred<File>()
const preparingState = createDirectChatState(api, () => preparation.promise)
preparingState.bindSession('S1', 1)
await preparingState.openThread(a)
const preparing = preparingState.send('old', [file])
await preparingState.openThread(b); await preparingState.openThread(a)
const count = attempts.length
preparation.resolve(file)
await preparing
assert.equal(attempts.length, count)
assert.equal(preparingState.pendingSend.value, null)
const failure = new Error('null image encode')
const failedPreparation = createDirectChatState(api, async () => { throw failure })
failedPreparation.bindSession('S1')
await failedPreparation.openThread(a)
await assert.rejects(failedPreparation.send('text', [file]), failure)
assert.equal(failedPreparation.pendingSend.value, null)
assert.equal(failedPreparation.sending.value, false)
assert.equal(attempts.length, count)
// Image downloads are lazy, single-flight, scoped, and revoked on close.
const revoked: string[] = []
let urls = 0
URL.createObjectURL = () => `blob:${++urls}`
URL.revokeObjectURL = url => { revoked.push(url) }
const imagePending = deferred<Blob>()
imageCall = () => imagePending.promise
const loadingImage = state.loadImage('image')
assert.equal(state.loadImage('image'), loadingImage)
await state.openThread(b); await state.openThread(a)
imagePending.resolve(new Blob(['old']))
assert.equal(await loadingImage, null)
assert.equal(urls, 0)
imageCall = async () => new Blob(['new'])
assert.equal(await state.loadImage('image'), 'blob:1')
state.closeThread()
assert.deepEqual(revoked, ['blob:1'])
// Auth change clears every resource and discards in-flight inbox/send responses.
await state.openThread(a)
const staleInbox = deferred<Awaited<ReturnType<typeof Service.fetchInbox>>>()
inboxCall = () => staleInbox.promise
const staleRefresh = state.refreshInbox()
const staleSend = deferred<Awaited<ReturnType<typeof Service.sendMessage>>>()
sendCall = () => staleSend.promise
const sending = state.send('old auth')
await new Promise(resolve => setImmediate(resolve))
state.bindSession('S2', 2)
staleInbox.resolve({ conversations: [row(99)] }); staleSend.resolve({ message: message(99) })
await Promise.all([staleRefresh, sending])
assert.deepEqual(state.inbox.value, [])
assert.deepEqual(state.messages.value, [])
assert.equal(state.pendingSend.value, null)
assert.equal(state.conversationId.value, null)
assert.equal(state.sending.value, false)
setActivePinia(createPinia())
const scope = effectScope()
const store = scope.run(() => useDirectChatStore())!
store.inbox = [row(4)]
store.messages = [message(1)]
auth.staff = null; auth.status = 'signedOut'
assert.equal(store.unreadTotal, 0)
assert.deepEqual(store.messages, [])
await nextTick()
store.$dispose(); scope.stop()
console.log('direct chat store dry test passed')
