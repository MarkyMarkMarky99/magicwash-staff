import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customer-packages/components/CustomerPackageTransactionForm.vue', import.meta.url),
  'utf8',
)

assert.match(source, /FormOverlay/, 'transaction form must use FormOverlay as its shell')
assert.match(source, /movementTypes/, 'transaction types must be supplied by the page contract boundary')
assert.match(source, /update:movementType/, 'transaction form must emit selected type to its page')
assert.match(source, /id="customer-package-credit-change"[\s\S]{0,200}type="number"[\s\S]{0,80}step="any"/, 'credit change must allow contract-permitted decimal movements')
assert.match(source, /@submit="emit\('submit'\)"/, 'transaction form must delegate submit orchestration to its page')
assert.doesNotMatch(source, /(?:appendPackageTransaction|customer-package\.service|\/api\/)/, 'presentational form must not call the service or API')
assert.doesNotMatch(source, /PURCHASE/, 'the form must not hard-code or reintroduce PURCHASE')

console.log('customer-package transaction-form dry tests passed')
