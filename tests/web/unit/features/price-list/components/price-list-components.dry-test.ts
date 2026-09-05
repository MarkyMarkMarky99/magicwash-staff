import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const card = source('features/price-list/components/PriceListCard.vue')
assert.match(card, /serviceType/)
assert.match(card, /price/)
assert.doesNotMatch(card, /washDryIronPrice|ironOnlyPrice|dryCleanPrice/)
assert.match(card, /font-extrabold[\s\S]{0,200}props\.item\.price/, 'price must be the prominent element on the card')

// The card deliberately shows only name, service and price. itemCode, priceGroup, unit,
// category and subcategory were removed in the 2026-09-06 redesign: priceGroup is DEFAULT
// and unit is 'piece' on every single row, so printing them added no information at all.
assert.doesNotMatch(card, /priceGroup/)
assert.doesNotMatch(card, /unit/)
assert.doesNotMatch(card, /subcategory/)

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
