import assert from 'node:assert/strict'
import test from 'node:test'
import { readSlip } from '../../../shared/ai-gateway/tasks/read-slip.js'
import { AiGatewayError } from '../../../shared/ai-gateway/ai-gateway.errors.js'
import { jsonResponse, slipResult, successEnvelope } from './read-slip.fixture.js'

const read = (result: object) => readSlip({ baseUrl: 'http://stub.invalid', getToken: async () => null,
  file: new Blob(['photo']), filename: 'photo.jpg', priceGroup: 'CRYO', fetchImpl: async (_, init) => {
    assert.ok(init?.body instanceof FormData)
    const request = JSON.parse(String(init.body.get('request')))
    assert.deepEqual(request.input, { priceGroup: 'CRYO' })
    assert.deepEqual(request.attachments, [{ file: 'file0', role: 'slip-page' }])
    return jsonResponse(successEnvelope(result))
  },
})

test('real slip example parses', async () => {
  assert.deepEqual(await read(slipResult), slipResult)
})

test('unknown extra fields are accepted and ignored at every object level', async () => {
  const extra = {
    ...slipResult, extra: true, header: { ...slipResult.header, extra: true,
      collectionDate: { ...slipResult.header.collectionDate, extra: true } },
    items: slipResult.items.map((item) => ({ ...item, extra: true })),
    unlisted: slipResult.unlisted.map((item) => ({ ...item, extra: true })),
    warnings: slipResult.warnings.map((warning) => ({ ...warning, extra: true })),
  }
  assert.deepEqual(await read(extra), slipResult)
})

const { items: omittedItems, ...withoutItems } = slipResult
for (const [name, result] of [
  ['string count', { ...slipResult, items: [{ ...slipResult.items[0], count: '8' }] }],
  ['negative count', { ...slipResult, items: [{ ...slipResult.items[0], count: -1 }] }],
  ['missing items', withoutItems],
  ['invalid warning source', { ...slipResult, warnings: [{ ...slipResult.warnings[0], source: 'x' }] }],
  ['missing date', { ...slipResult, header: { ...slipResult.header, collectionDate: { text: null } } }],
] as const) {
  test(`${name} is INVALID_RESPONSE`, async () => {
    await assert.rejects(read(result), (error: unknown) => {
      assert.ok(error instanceof AiGatewayError)
      assert.equal(error.code, 'INVALID_RESPONSE')
      return true
    })
  })
}
