import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const card = source('features/price-list/components/PriceListCard.vue')
assert.match(card, /itemCode/)
assert.match(card, /serviceType/)
assert.match(card, /priceGroup/)
assert.match(card, /price/)
assert.doesNotMatch(card, /washDryIronPrice|ironOnlyPrice|dryCleanPrice/)
assert.match(card, /price[\s\S]{0,180}(?:text-(?:xl|2xl|3xl)|font-(?:bold|semibold))/i)

const triad = new URL(
  '../../../../../../src/features/price-list/components/ServicePriceTriad.vue',
  import.meta.url,
)
assert.equal(existsSync(triad), false, 'retired ServicePriceTriad must be deleted')

const statusTabs = new URL(
  '../../../../../../src/features/price-list/components/PriceListStatusTabs.vue',
  import.meta.url,
)
const list = source('features/price-list/pages/PriceListPage.vue')
if (existsSync(statusTabs)) {
  assert.match(list, /PriceListStatusTabs/, 'status tabs must be wired into PriceListPage')
} else {
  assert.doesNotMatch(list, /PriceListStatusTabs/)
}

console.log('price-list-components.dry-test: OK')
