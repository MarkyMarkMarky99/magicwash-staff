import assert from 'node:assert/strict'
import test from 'node:test'
import { sendChat } from '../../../shared/ai-gateway/tasks/chat.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'

const customer = {
  customerName: 'Customer', phone: null, address: null, lineId: null, facebook: null,
  whatsapp: null, email: null, customerType: 'Regular', warnings: [],
}
const price = { rows: [{ itemCode: 'A', name: 'Shirt', serviceType: 'WSIR', priceGroup: 'Standard', unit: null, price: 50 }] }
const result = { agentId: 'register-customer', sessionId: 'session-1', reply: 'Hello', proposal: customer, warnings: [] }
const envelope = (value: object) => ({ ok: true, requestId: 'req-1', task: 'chat', taskVersion: 1, ms: 1, result: value })
const options = { baseUrl: 'http://stub.invalid', getToken: async () => null, agentId: 'register-customer' as const, message: 'Hello', files: [] }

for (const sessionId of [null, 'session-1']) {
  test(`multipart input ${sessionId === null ? 'omits first' : 'includes later'} session ID`, async () => {
    const reply = await sendChat({ ...options, sessionId, files: [
      { blob: new Blob(['first'], { type: 'image/jpeg' }), filename: 'image-1.jpg' },
      { blob: new Blob(['second'], { type: 'image/png' }), filename: 'image-2.png' },
    ], fetchImpl: async (url, init) => {
      assert.equal(url, 'http://stub.invalid/tasks/chat')
      assert.equal(init?.method, 'POST')
      assert.ok(init?.body instanceof FormData)
      const body = JSON.parse(String(init.body.get('request')))
      assert.deepEqual(body.input, { agentId: options.agentId, message: 'Hello', ...(sessionId ? { sessionId } : {}) })
      assert.deepEqual(body.attachments, [{ file: 'file0', role: 'reference' }, { file: 'file1', role: 'reference' }])
      assert.equal(await (init.body.get('file0') as Blob).text(), 'first')
      assert.equal(await (init.body.get('file1') as Blob).text(), 'second')
      return Response.json(envelope(result))
    } })
    assert.deepEqual(reply, result)
  })
}

for (const proposal of [customer, price, null]) {
  test(`valid result with ${proposal === null ? 'null' : 'rows' in proposal ? 'price' : 'customer'} proposal`, async () => {
    const value = { ...result, proposal }
    assert.deepEqual(await sendChat({ ...options, fetchImpl: async (_, init) => {
      assert.equal(typeof init?.body, 'string')
      assert.deepEqual(JSON.parse(init!.body as string).input, { agentId: options.agentId, message: 'Hello' })
      return Response.json(envelope(value))
    } }), value)
  })
}

for (const value of [
  { ...result, sessionId: null },
  { ...result, proposal: { ...customer, customerType: 'Other' } },
  { ...result, proposal: { rows: [{ ...price.rows[0], serviceType: 'OTHER' }] } },
  { ...result, proposal: { rows: [{ ...price.rows[0], price: '50' }] } },
  { ...result, warnings: [{ field: 'phone', source: 'other', message: 'Warning' }] },
]) {
  test('invalid result becomes INVALID_RESPONSE', async () => {
    await assert.rejects(sendChat({ ...options, fetchImpl: async () => Response.json(envelope(value)) }),
      (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_RESPONSE')
  })
}

test('SESSION_NOT_FOUND is surfaced with HTTP 404', async () => {
  await assert.rejects(sendChat({ ...options, sessionId: 'expired', fetchImpl: async () => Response.json({
    ok: false, requestId: 'req-1', task: 'chat', error: { code: 'SESSION_NOT_FOUND', message: 'Expired' },
  }, { status: 404 }) }), (error: unknown) => error instanceof AiGatewayError && error.code === 'SESSION_NOT_FOUND' && error.status === 404)
})

test('empty text is allowed with an image', async () => {
  await sendChat({ ...options, message: '', files: [{ blob: new Blob(['photo'], { type: 'image/jpeg' }), filename: 'image.jpg' }],
    fetchImpl: async () => Response.json(envelope(result)) })
})

test('empty text without images fails before fetch', async () => {
  await assert.rejects(sendChat({ ...options, message: '', fetchImpl: async () => assert.fail('unexpected fetch') }),
    (error: unknown) => error instanceof AiGatewayError && error.code === 'INVALID_INPUT')
})
