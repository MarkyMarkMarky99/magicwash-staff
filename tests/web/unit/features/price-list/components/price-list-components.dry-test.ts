import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const card = source('features/price-list/components/PriceListCard.vue')
// The card must render a Thai label, not the raw WSIR/DRCL code — matching /serviceType/
// alone would pass on the import line even if the code were printed verbatim.
assert.match(card, /serviceTypeLabel\(props\.item\.serviceType\)/)
assert.doesNotMatch(card, /\{\{\s*props\.item\.serviceType\s*\}\}/)
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

// The service filter replaced the status tabs; assert the replacement is actually wired.
const list = source('features/price-list/pages/PriceListPage.vue')
assert.match(list, /PriceListServiceFilter/)
assert.match(list, /PriceListServicePanel/)
// The panel must reach the empty and error slots, or a filter matching nothing cannot be cleared.
assert.match(list, /#empty[\s\S]{0,400}PriceListServicePanel/)
assert.match(list, /#error[\s\S]{0,400}PriceListServicePanel/)

const statusTabs = new URL(
  '../../../../../../src/features/price-list/components/PriceListStatusTabs.vue',
  import.meta.url,
)
if (existsSync(statusTabs)) {
  assert.match(list, /PriceListStatusTabs/, 'status tabs must be wired into PriceListPage')
} else {
  assert.doesNotMatch(list, /PriceListStatusTabs/)
}

console.log('price-list-components.dry-test: OK')
