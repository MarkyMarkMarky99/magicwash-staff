import assert from 'node:assert/strict'
import { resolveBackTarget } from '../../../../../src/shared/composables/use-go-back'

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

test('returns browser history back when history is present', () => {
  assert.deepEqual(resolveBackTarget(true, 'customer-list'), { action: 'back' })
})

test('pushes to the parent when history is absent and a parent is set', () => {
  assert.deepEqual(resolveBackTarget(false, 'invoice-list'), {
    action: 'push',
    name: 'invoice-list',
  })
})

test('falls back to the customer list when history and parent are absent', () => {
  assert.deepEqual(resolveBackTarget(false, undefined), {
    action: 'fallback',
    name: 'customer-list',
  })
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} go-back resolver dry tests passed`)
