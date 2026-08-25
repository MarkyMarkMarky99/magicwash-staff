import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function page(name: string): string {
  return readFileSync(new URL(`../../../../../../src/features/customer-packages/pages/${name}`, import.meta.url), 'utf8')
}

const list = page('CustomerPackageListPage.vue')
for (const field of ['customerName', 'packageName', 'status', 'remainingCredit', 'usedCredit', 'totalCredit', 'packageCode']) {
  assert.match(list, new RegExp(`\\b${field}\\b`), `list must render ${field}`)
}
assert.match(list, /router\.push\(/, 'clicking a list card must navigate to detail')

const detail = page('CustomerPackageDetailPage.vue')
for (const field of ['remainingCredit', 'usedCredit', 'totalCredit']) {
  assert.match(detail, new RegExp(`\\b${field}\\b`), `detail must render DTO ${field} directly`)
}
assert.match(detail, /ListContainer/, 'detail must render its transaction timeline with ListContainer')
for (const type of ['PURCHASE', 'USAGE']) {
  assert.match(detail, new RegExp(`\\b${type}\\b`), `timeline labels must cover ${type}`)
}
assert.match(detail, /\b(?:REFUND|VOID|ADJUSTMENT|EXPIRE|TRANSFER)\b/, 'timeline labels must cover another transaction type')
assert.doesNotMatch(detail, /(?:option[^>]*value|value[^>]*option)[^>]*PURCHASE/i, 'the add-transaction selector must not offer PURCHASE')
assert.match(detail, /USAGE[\s\S]{0,800}(?:positive|>\s*0)|(?:positive|>\s*0)[\s\S]{0,800}USAGE/, 'positive USAGE must be flagged before submit')
assert.match(detail, /REFUND[\s\S]{0,800}(?:negative|<\s*0)|(?:negative|<\s*0)[\s\S]{0,800}REFUND/, 'negative REFUND must be flagged before submit')

const create = page('CustomerPackageCreatePage.vue')
assert.match(create, /CustomerPackageCreatePage/, 'create page must use the stable component name')
assert.match(create, /\bonMounted\b/, 'create page must use onMounted')
assert.doesNotMatch(create, /\bon(?:Activated|Deactivated)\b/, 'uncached create page must not use activated hooks')
assert.match(create, /customerId/, 'create page must support customerId query prefill')

const app = readFileSync(new URL('../../../../../../src/App.vue', import.meta.url), 'utf8')
assert.match(app, /exclude[^>]*CustomerPackageCreatePage|CustomerPackageCreatePage[^>]*exclude/, 'App KeepAlive must exclude CustomerPackageCreatePage')

console.log('customer-package page dry tests passed')
