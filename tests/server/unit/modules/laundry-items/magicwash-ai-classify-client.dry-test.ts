import assert from 'node:assert/strict'
import { triggerLaundryItemClassification } from '../../../../../server/modules/laundry-items/magicwash-ai-classify-client.js'

const previousUrl = process.env.VITE_AI_GATEWAY_URL
const previousSecret = process.env.AI_GATEWAY_SECRET
const warn = console.warn
const warnings: unknown[][] = []
console.warn = (...args) => { warnings.push(args) }
try {
  let calls = 0
  const fetchImpl: typeof fetch = async (url, options) => {
    calls++
    assert.equal(url, 'https://ai.example.test/tasks/classify-laundry-items')
    assert.equal(options?.method, 'POST')
    assert.deepEqual(options?.headers, {
      'content-type': 'application/json', authorization: 'Bearer test-secret', 'x-acting-staff-id': 'staff-1',
    })
    assert.equal(options?.body, '{"input":{}}')
    assert.ok(options?.signal instanceof AbortSignal)
    return new Response(null, { status: 202 })
  }
  delete process.env.VITE_AI_GATEWAY_URL
  delete process.env.AI_GATEWAY_SECRET
  assert.equal(await triggerLaundryItemClassification('staff-1', fetchImpl), false)
  process.env.VITE_AI_GATEWAY_URL = 'https://ai.example.test///'
  process.env.AI_GATEWAY_SECRET = ' '
  assert.equal(await triggerLaundryItemClassification('staff-1', fetchImpl), false)
  assert.equal(calls, 0)
  assert.equal(warnings.length, 2)
  process.env.AI_GATEWAY_SECRET = 'test-secret'
  assert.equal(await triggerLaundryItemClassification('staff-1', fetchImpl), true)
  assert.equal(calls, 1)
  assert.equal(await triggerLaundryItemClassification('staff-1', async () => new Response(null, { status: 204 })), true)
  assert.equal(await triggerLaundryItemClassification('staff-1', async () => new Response(null, { status: 500 })), false)
  assert.equal(await triggerLaundryItemClassification('staff-1', async () => { throw new Error('test-secret') }), false)
  assert.ok(!JSON.stringify(warnings).includes('test-secret'))
} finally {
  console.warn = warn
  if (previousUrl === undefined) delete process.env.VITE_AI_GATEWAY_URL
  else process.env.VITE_AI_GATEWAY_URL = previousUrl
  if (previousSecret === undefined) delete process.env.AI_GATEWAY_SECRET
  else process.env.AI_GATEWAY_SECRET = previousSecret
}
console.log('MagicwashAI classification client dry tests passed')
