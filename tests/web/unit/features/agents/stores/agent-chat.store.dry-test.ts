import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

mock.module('../../../../../../src/shared/ai-gateway/ai-gateway.config.ts', {
  namedExports: { aiGatewayBaseUrl: () => 'http://stub.invalid', aiGatewayToken: async () => null },
})
const { useAgentChatStore } = await import('../../../../../../src/features/agents/stores/agent-chat.store.ts')
const originalFetch = globalThis.fetch
const inputs: Record<string, unknown>[] = []
let mode: 'success' | 'expired' | 'pending' | 'failure' = 'success'
let pendingSignal: AbortSignal | undefined
const customerProposal = { customerName: 'Customer', phone: null, address: null, lineId: null, facebook: null,
  whatsapp: null, email: null, customerType: 'Member', warnings: [{ field: 'phone', message: 'Inner warning' }] }
const warnings = [{ field: 'phone', source: 'ai', message: 'Top-level warning' }]
let agentId = 'register-customer'
let proposal: object | null = customerProposal
const success = () => Response.json({ ok: true, requestId: 'req', task: 'chat', taskVersion: 1, ms: 1,
  result: { agentId, sessionId: 'session-1', reply: 'Hello', proposal, warnings } })
globalThis.fetch = async (_, init) => {
  inputs.push(JSON.parse(init!.body as string).input)
  if (mode === 'expired') return Response.json({ ok: false, requestId: 'req', task: 'chat',
    error: { code: 'SESSION_NOT_FOUND', message: 'Expired' } }, { status: 404 })
  if (mode === 'failure') throw new Error('Offline')
  if (mode === 'pending') {
    pendingSignal = init!.signal as AbortSignal
    return new Promise<Response>(() => {})
  }
  return success()
}

setActivePinia(createPinia())
const store = useAgentChatStore()
try {
  await store.sendText('register-customer', 'First')
  assert.equal(store.chats['register-customer'].sessionId, 'session-1')
  assert.equal('sessionId' in inputs[0], false)
  const firstReply = store.chats['register-customer'].messages.at(-1)!
  assert.equal(firstReply.role, 'agent')
  if (firstReply.role !== 'agent') assert.fail('Expected agent reply')
  const { warnings: innerWarnings, ...customer } = customerProposal
  assert.deepEqual(firstReply.proposal, customer)
  assert.deepEqual(firstReply.warnings, warnings)
  mode = 'expired'
  await store.sendText('register-customer', 'New message')
  assert.equal(inputs[1].sessionId, 'session-1')
  assert.equal(store.chats['register-customer'].sessionId, null)
  assert.deepEqual(store.chats['register-customer'].messages.at(-1), {
    id: store.chats['register-customer'].messages.at(-1)!.id,
    role: 'error', text: 'The previous chat expired and a new one started. Tap Retry to send again.',
  })
  mode = 'success'
  await store.retry('register-customer')
  assert.deepEqual(inputs[2], { agentId: 'register-customer', message: 'New message' })
  assert.equal(store.chats['register-customer'].messages.filter(message => message.role === 'staff').length, 2)
  assert.equal(store.chats['register-customer'].messages.some(message => message.role === 'error'), false)
  mode = 'failure'
  await store.sendText('register-customer', 'Offline')
  const error = store.chats['register-customer'].messages.at(-1)!
  assert.equal(error.role, 'error')
  assert.equal('text' in error, false)
  mode = 'pending'
  const sending = store.sendText('register-customer', 'Pending')
  while (!pendingSignal) await new Promise(resolve => setImmediate(resolve))
  store.reset('register-customer')
  assert.equal(pendingSignal.aborted, true)
  await sending
  assert.equal(store.chats['register-customer'].sessionId, null)
  assert.deepEqual(store.chats['register-customer'].messages, [])
  assert.equal(store.chats['register-customer'].thinking, false)
  mode = 'success'
  agentId = 'price-check'
  proposal = { rows: [{ itemCode: 'A', name: 'Shirt', serviceType: 'WSIR', priceGroup: 'Standard', unit: null, price: 50 }] }
  await store.sendText('price-check', 'Price?')
  const priceReply = store.chats['price-check'].messages.at(-1)!
  assert.equal(priceReply.role, 'agent')
  if (priceReply.role !== 'agent') assert.fail('Expected price reply')
  assert.deepEqual(priceReply.proposal, proposal)
  assert.equal(inputs.at(-1)!.agentId, 'price-check')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
  mock.restoreAll()
}
console.log('agent-chat.store.dry-test: OK')
