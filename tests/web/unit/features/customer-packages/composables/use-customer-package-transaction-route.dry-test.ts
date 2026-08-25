import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customer-packages/composables/useCustomerPackageTransactionRoute.ts', import.meta.url),
  'utf8',
)

assert.match(source, /const QUERY_KEY = 'transaction'/, 'transaction overlay must use its dedicated query key')
assert.match(source, /computed\(/, 'overlay open state must derive from the route query')
assert.doesNotMatch(source, /\bref\s*\(/, 'route state must not be mirrored into a local ref')
assert.match(source, /router\.push\(/, 'opening the overlay must create a Back-dismissible route entry')
assert.match(source, /router\.back\(\)/, 'a route entry pushed here must close with Back')
assert.match(source, /router\.replace\(/, 'deep-linked overlays must close by removing only the query parameter')
assert.match(source, /delete query\[QUERY_KEY\]/, 'deep-link close must preserve unrelated query parameters')
assert.doesNotMatch(source, /(?:history\.|popstate)/, 'the overlay composable must leave browser history to vue-router')

console.log('customer-package transaction-route dry tests passed')
