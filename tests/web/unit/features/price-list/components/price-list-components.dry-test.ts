import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL('../../../../../../src/' + path, import.meta.url), 'utf8')
}

const card = source('features/price-list/components/PriceListCard.vue')
assert.match(card, /itemCode/)
assert.match(card, /props\.items\.length/)
assert.match(card, /emit\('open', props\.itemCode\)/)
assert.match(card, /BaseSwipeCard/)
assert.match(card, /ImageContentCard/)
assert.doesNotMatch(card, /ImageOrIcon/)
assert.match(card, /#left-panel/)
assert.doesNotMatch(card, /'chevron_right' : 'edit'/)
assert.doesNotMatch(card, /washDryIronPrice|ironOnlyPrice|dryCleanPrice/)

const picker = source('features/price-list/components/PriceListItemPicker.vue')
assert.match(picker, /selectCategory\(name\)/)
assert.match(picker, /subcategory === name/)
assert.match(picker, /add_shopping_cart/)
assert.match(picker, /fit="contain"/)
assert.doesNotMatch(picker, /ImageContentCard/)
const sharedImageCard = source('shared/components/ImageContentCard.vue')
assert.match(sharedImageCard, /ImageOrIcon/)
assert.match(sharedImageCard, /fit="cover"/)

const optionsSheet = source('features/price-list/components/PriceListOptionsSheet.vue')
assert.match(optionsSheet, /DetailOverlay/)
assert.match(optionsSheet, /size="auto"/)
assert.match(optionsSheet, /emit\('select', option\.id\)/)
assert.match(optionsSheet, /serviceTypeLabel\(option\.serviceType\)/)
assert.match(optionsSheet, /needsDisambiguation\(option\)/)
assert.match(optionsSheet, /option\.active/)

const triad = new URL(
  '../../../../../../src/features/price-list/components/ServicePriceTriad.vue',
  import.meta.url,
)
assert.equal(existsSync(triad), false, 'retired ServicePriceTriad must be deleted')

const list = source('features/price-list/pages/PriceListPage.vue')
assert.match(list, /PriceListServiceFilter/)
assert.match(list, /PriceListServicePanel/)
assert.match(list, /itemGroups/)
assert.match(list, /PriceListOptionsSheet/)
assert.match(list, /group\.items\.length === 1/)
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
