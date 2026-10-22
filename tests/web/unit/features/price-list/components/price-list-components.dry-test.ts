import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL('../../../../../../src/' + path, import.meta.url), 'utf8')
}

const card = source('features/price-list/components/PriceListSubcategoryCard.vue')
assert.doesNotMatch(card, /BaseBadge/, 'the Thai name already carries the variant; no badge')
assert.match(card, /showServiceLabels/)
assert.match(card, /emit\('edit'/)
assert.doesNotMatch(card, /ImageOrIcon|ImageContentCard|<img/)
assert.doesNotMatch(card, /features\/agents/)

for (const retired of ['PriceListCard', 'PriceListOptionsSheet', 'PriceListServiceFilter', 'PriceListServicePanel']) {
  assert.equal(
    existsSync(new URL(`../../../../../../src/features/price-list/components/${retired}.vue`, import.meta.url)),
    false,
    `${retired} must stay deleted`,
  )
}

const picker = source('features/price-list/components/PriceListItemPicker.vue')
assert.match(picker, /selectCategory\(name\)/)
assert.match(picker, /subcategory === name/)
assert.match(picker, /add_shopping_cart/)
assert.match(picker, /fit="contain"/)
assert.doesNotMatch(picker, /ImageContentCard/)
const sharedImageCard = source('shared/components/ImageContentCard.vue')
assert.match(sharedImageCard, /ImageOrIcon/)
assert.match(sharedImageCard, /fit="cover"/)

const triad = new URL(
  '../../../../../../src/features/price-list/components/ServicePriceTriad.vue',
  import.meta.url,
)
assert.equal(existsSync(triad), false, 'retired ServicePriceTriad must be deleted')

const list = source('features/price-list/pages/PriceListPage.vue')
assert.match(list, /PriceListSubcategoryCard/)
assert.match(list, /PriceListServiceSwitch/)
assert.match(list, /retailPriceRows/)
assert.doesNotMatch(list, /ListContainer|searchable|PriceListOptionsSheet|ImageOrIcon/)

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
