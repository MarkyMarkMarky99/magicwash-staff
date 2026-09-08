import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customers/components/OrderDetailSheet.vue', import.meta.url),
  'utf8',
)

assert.match(source, /import ListContainer from '@\/shared\/components\/ListContainer\.vue'/)
assert.match(source, /<ListContainer[\s\S]*:key="order\.orderId"[\s\S]*title="Items"[\s\S]*collapsible/)
assert.match(source, /<ul class="divide-y divide-outline-variant\/10">/)
assert.doesNotMatch(source, /\bitemsOpen\b/, 'ListContainer must own collapse state')

console.log('order detail sheet dry tests passed')
