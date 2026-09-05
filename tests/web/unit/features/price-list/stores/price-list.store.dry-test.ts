import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/price-list/stores/price-list.store.ts', import.meta.url),
  'utf8',
)

for (const stateName of ['items', 'loading', 'error', 'truncated']) {
  assert.match(source, new RegExp(`\\b${stateName}\\b`), `store must expose ${stateName} state`)
}
assert.match(source, /listAllPriceList/, 'store must load through the complete-catalogue service')
assert.match(source, /truncated[\s\S]{0,500}(?:error|throw)/i, 'a truncated catalogue must surface a load error')
assert.match(source, /(?:truncated|complete)[\s\S]{0,500}loaded[\s\S]{0,500}(?:false|error)/i, 'truncation must not imply a complete loaded state')

console.log('price-list.store.dry-test: OK')
