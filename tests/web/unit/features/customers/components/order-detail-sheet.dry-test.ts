import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customers/components/OrderDetailSheet.vue', import.meta.url),
  'utf8',
)

assert.match(source, /import ListContainer from '@\/shared\/components\/ListContainer\.vue'/)
assert.match(source, /getWorkOrder\(/)
const itemsListContainer = source.match(/<ListContainer\b[^>]*>/)?.[0]
assert.ok(itemsListContainer)
assert.match(itemsListContainer, /:key="order\.orderId"/)
assert.match(itemsListContainer, /title="Items"/)
assert.doesNotMatch(itemsListContainer, /\bcollapsible\b/)
assert.match(itemsListContainer, /:empty="items\.length === 0"/)
assert.match(itemsListContainer, /empty-text="No items yet"/)

const actions = source.match(/<template #actions>[\s\S]*?<\/BaseDropdown>/)?.[0]
assert.ok(actions)
assert.match(actions, /<BaseDropdown\b/)
assert.match(actions, /aria-label="Order actions"/)
assert.match(actions, /View Photos[\s\S]*Book Delivery[\s\S]*Create Invoice[\s\S]*Use package credit/)
assert.match(source, /<ul class="divide-y divide-outline-variant\/10">/)
assert.doesNotMatch(source, /\bitemsOpen\b/, 'ListContainer must own collapse state')

console.log('order detail sheet dry tests passed')
