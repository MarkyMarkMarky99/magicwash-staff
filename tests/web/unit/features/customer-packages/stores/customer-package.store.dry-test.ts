import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/data/customer-packages/customer-package.store.ts', import.meta.url),
  'utf8',
)

for (const stateName of ['items', 'page', 'perPage', 'loading', 'error']) {
  assert.match(source, new RegExp(`\\b${stateName}\\b`), `store must expose ${stateName} state`)
}
assert.match(source, /fetchCustomerPackages/, 'store must expose fetchCustomerPackages')
assert.match(source, /latestRequest/, 'store must guard against stale requests')
assert.match(source, /onCacheInvalidated/, 'loaded table state must refresh after invalidation')
assert.doesNotMatch(source, /\b(?:createCustomerPackage|getCustomerPackageDetail)\b/, 'store must not own create or detail actions')

console.log('customer-package store dry tests passed')
