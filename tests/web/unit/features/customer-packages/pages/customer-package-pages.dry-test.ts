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
const summaryCard = readFileSync(new URL('../../../../../../src/features/customer-packages/components/CustomerPackageSummaryCard.vue', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../../../../../../src/features/customer-packages/preview/variant-c/VariantC.vue', import.meta.url), 'utf8')
assert.match(detail, /CustomerPackageSummaryCard/, 'detail must render the package summary card')
assert.match(detail, /:customer-package="customerPackage"/, 'detail must pass the loaded package to its summary card')
assert.match(preview, /CustomerPackageSummaryCard/, 'preview must reuse the package summary card')
assert.match(preview, /:customer-package="sourcePackage"/, 'preview must pass its fixture package to the summary card')
for (const field of ['customerName', 'packageName', 'remainingCredit', 'totalCredit', 'expiryDate']) {
  assert.match(summaryCard, new RegExp(`\\b${field}\\b`), `summary card must render ${field}`)
}
for (const noise of ['usedCredit', 'packageCode', 'packageEligibleService', 'customerPhone', 'customerAddress', 'customerId']) {
  assert.doesNotMatch(summaryCard, new RegExp(`\\b${noise}\\b`), `summary card must not show ${noise}`)
}
assert.match(summaryCard, /role="progressbar"/, 'summary card must expose its credit balance as progress')
assert.match(summaryCard, /aria-valuenow="creditBalancePercent"/, 'progress must expose its current balance')
assert.match(summaryCard, /totalCredit\s*<=\s*0\) return 0/, 'zero total credit must produce a safe zero balance')
assert.match(summaryCard, /Math\.min\(100, Math\.max\(0/, 'credit balance must be clamped to progress bounds')
assert.match(summaryCard, /serviceDay\?\.trim\(\) \|\| 'Flexible'/, 'missing pickup day must remain Flexible')
assert.match(summaryCard, /timeSlot\?\.trim\(\) \|\| 'By appointment'/, 'missing pickup time must remain By appointment')
assert.match(summaryCard, /tone: 'lime'/, 'an active package must use the lime status badge')
assert.match(summaryCard, /status === 'EXPIRED'\) return \{ label: 'Expired', tone: 'danger', variant: 'solid' \}/, 'an expired package must use the solid danger badge')
assert.match(detail, /:customer-index="customerIndex"/, 'detail must pass the customer index resolved from the customer store')
assert.doesNotMatch(detail, /customerPhone|customerAddress/, 'detail must not show customer phone or address')
assert.match(detail, /<section[^>]*aria-labelledby="package-activity-title"/, 'detail must render the activity section')
assert.match(detail, /<h2 id="package-activity-title"[^>]*>Package activity<\/h2>/, 'activity section must have the approved title')
assert.match(detail, /<p[^>]*>Credit movements<\/p>/, 'activity section must show its subtitle')
assert.match(detail, /recentTransactions = computed\(\(\) => \[\.\.\.\(customerPackage\.value\?\.transactions \?\? \[\]\)\]\.reverse\(\)\)/, 'activity must list the newest movement first')
assert.match(detail, /<li v-for="transaction in recentTransactions"[^>]*:class="changeColumnClass"/, 'activity rows must share the computed change column width')
assert.match(detail, /<span[^>]*>\{\{ transaction\.remainingCredit \}\}<\/span>credits<\/p>/, 'each activity row must show its balance after the movement')
assert.match(detail, /Math\.abs\(transaction\.creditChange\) >= 100\)[\s\S]*?\? 'grid-cols-\[44px_minmax\(0,1fr\)_58px\]'[\s\S]*?: 'grid-cols-\[36px_minmax\(0,1fr\)_58px\]'/, 'three-digit changes must use the 44px column and smaller changes the 36px column')
assert.match(detail, /<button[^>]*@click="openTransaction"[^>]*>Add transaction<\/button>/, 'add transaction button must open the transaction form')
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
assert.match(detail, /listWorkOrders\(\{ customerId: packageValue.customerId, page, perPage: 500/, 'orders must load by customer across pages')
assert.match(detail, /getCustomerPackages\(\{ customerId: packageValue.customerId, status: 'ACTIVE'/, 'transfer targets must be active packages of the same customer')
assert.match(detail, /item.customerPackageId !== packageValue.customerPackageId/, 'transfer target must exclude the current package')
assert.match(detail, /type === 'EXPIRE' \? -packageValue.remainingCredit/, 'expire must remove the full remaining balance')
assert.match(detail, /type === 'VOID' \? -\(transaction\?\.creditChange \?\? 0\)/, 'void must reverse the full selected transaction')
assert.match(detail, /item.id === selectedTransactionId.value && item.type !== 'PURCHASE' && item.type !== 'VOID'[\s\S]*?!customerPackage.value\?\.transactions.some\(\(transaction\) => transaction.type === 'VOID' && transaction.referenceId === item.id\)/, 'submit guard must reject an already voided transaction')
assert.match(detail, /type === 'USAGE' \|\| \(type === 'ADJUSTMENT' && adjustmentDirection.value === 'DEDUCT'\)/, 'usage and deduct adjustments must send negative credits')
assert.match(detail, /referenceSource: type === 'USAGE' \|\| type === 'REFUND' \? 'ORDER' : type === 'VOID' \? 'PackageTransactions' : null/, 'references must be assigned by type')
assert.match(detail, /transactionType.value === 'TRANSFER'\) return false/, 'transfer must never submit')
assert.match(detail, /transactionType.value === 'USAGE' \|\| \(transactionType.value === 'ADJUSTMENT' && adjustmentDirection.value === 'DEDUCT'\)[\s\S]*?Number\(credits.value\) > customerPackage.value.remainingCredit\) return false/, 'usage and deduct adjustments must not exceed remaining credits')
assert.match(detail, /transactionType.value === 'ADJUSTMENT'\) return !!transactionNotes.value.trim\(\)/, 'adjustments require nonblank notes')
assert.match(detail, /Number.isSafeInteger\(Number\(credits.value\)\)/, 'credits must be a whole number')
assert.doesNotMatch(detail, /signHint|signInvalid|referenceSource.value|referenceId.value/, 'legacy sign validation and reference fields must be removed')

const create = page('CustomerPackageCreatePage.vue')
assert.match(create, /CustomerPackageCreatePage/, 'create page must use the stable component name')
assert.match(create, /\bonMounted\b/, 'create page must use onMounted')
assert.doesNotMatch(create, /\bon(?:Activated|Deactivated)\b/, 'uncached create page must not use activated hooks')
assert.match(create, /customerId/, 'create page must support customerId query prefill')
assert.doesNotMatch(create, /defineProps|defineEmits/, 'create page must be route-owned rather than embedded')
assert.match(create, /useCloseRoute/, 'create page must use history-aware close')

const app = readFileSync(new URL('../../../../../../src/App.vue', import.meta.url), 'utf8')
assert.match(app, /exclude[^>]*CustomerPackageCreatePage|CustomerPackageCreatePage[^>]*exclude/, 'App KeepAlive must exclude CustomerPackageCreatePage')

console.log('customer-package page dry tests passed')
