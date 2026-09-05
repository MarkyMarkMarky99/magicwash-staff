import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const form = source('features/price-list/pages/PriceListFormPage.vue')
assert.match(form, /defineOptions\(\{ name: 'PriceListFormPage' \}\)/)
assert.match(form, /price-list-form-payload/)
assert.match(form, /itemCode/)
assert.match(form, /readonly|:readonly/)
assert.match(form, /displayNameTh[\s\S]*itemCode|itemCode[\s\S]*displayNameTh/)
assert.match(form, /displayNameEn[\s\S]*itemCode|itemCode[\s\S]*displayNameEn/)
assert.match(form, /subcategory[\s\S]*itemType|itemType[\s\S]*subcategory/)
assert.match(form, /serviceType/)
assert.match(form, /priceGroup/)
assert.match(form, /unit/)
assert.match(form, /price/)
assert.match(form, /truncated/)
assert.match(form, /disabled|:disabled/)
assert.doesNotMatch(form, /washDryIronPrice|ironOnlyPrice|dryCleanPrice/)
assert.doesNotMatch(form, /Math\.max|padStart\(/)
assert.doesNotMatch(form, /(?:duplicate|already exists|unique)[\s\S]{0,80}(?:itemCode|serviceType|priceGroup)/i)

const list = source('features/price-list/pages/PriceListPage.vue')
const statusTabs = 'src/features/price-list/components/PriceListStatusTabs.vue'
if (existsSync(new URL(`../../../../../../${statusTabs}`, import.meta.url))) {
  assert.match(list, /PriceListStatusTabs/)
  assert.match(list, /active|inactive/i)
} else {
  assert.doesNotMatch(list, /PriceListStatusTabs/)
}

assert.match(list, /PriceListCard/)
assert.match(list, /truncated|error/i)

console.log('price-list-pages.dry-test: OK')
