import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customer-packages/composables/useCustomerPackageFilterRoute.ts', import.meta.url),
  'utf8',
)

for (const field of ['keyword', 'customerId', 'status', 'packageCode']) {
  assert.match(source, new RegExp(`\\b${field}\\b`), `filter route must support ${field}`)
}
assert.match(source, /router\.replace\(/, 'filter changes must replace the current route')
assert.doesNotMatch(source, /router\.(?:push|back)\(/, 'filter changes must never push or go back')
assert.doesNotMatch(source, /\bref\s*\(/, 'URL state must not be mirrored into a local ref')

console.log('customer-package filter-route dry tests passed')
