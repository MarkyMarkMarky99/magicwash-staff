import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function page(name: string): string {
  return readFileSync(new URL(`../../../../../../src/features/customer-packages/pages/${name}`, import.meta.url), 'utf8')
}

const list = page('CustomerPackageListPage.vue')
const listCards = readFileSync(new URL('../../../../../../src/features/customer-packages/components/CustomerPackageListCards.vue', import.meta.url), 'utf8')
for (const field of ['customerName', 'packageName', 'status', 'remainingCredit', 'usedCredit', 'totalCredit', 'packageCode']) {
  assert.match(listCards, new RegExp(`\\b${field}\\b`), `list must render ${field}`)
}
assert.match(list, /router\.push\(/, 'clicking a list card must navigate to detail')

const detail = page('CustomerPackageDetailPage.vue')
for (const field of ['remainingCredit', 'usedCredit', 'totalCredit']) {
  assert.match(detail, new RegExp(`\\b${field}\\b`), `detail must render DTO ${field} directly`)
}
assert.match(detail, /ListContainer/, 'detail must render its transaction timeline with ListContainer')
assert.match(detail, /<template #actions><button[^>]*@click="openTransaction"/, 'add transaction must be an action in the activity ListContainer')
assert.match(detail, /CustomerPackageTransactionForm/, 'detail page must render the transaction form boundary')
assert.match(detail, /useCustomerPackageTransactionRoute/, 'transaction form visibility must be query-route controlled')
assert.match(detail, /await loadDetail\(\)[\s\S]{0,300}resetTransactionForm\(\)[\s\S]{0,300}closeTransactionForm\(\)/, 'a created transaction must refresh details before clearing and closing')
assert.match(detail, /transactionRetryBlocked/, 'unknown write outcomes must block unsafe resubmission')
assert.match(detail, /needs reconciliation/, 'unknown write outcome must tell staff to reconcile activity')
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
