import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customer-packages/components/CustomerPackageTransactionForm.vue', import.meta.url),
  'utf8',
)
const picker = readFileSync(new URL('../../../../../../src/shared/components/FormPicker.vue', import.meta.url), 'utf8')
assert.match(picker, /<slot name="option" :option="option">[\s\S]*?picker__option-label[\s\S]*?picker__option-description[\s\S]*?<\/slot>/, 'custom option slot must preserve the default option row')

assert.match(source, /FormOverlay/, 'transaction form must use FormOverlay as its shell')
assert.match(source, /movementTypes/, 'transaction types must be supplied by the page contract boundary')
assert.match(source, /update:movementType/, 'transaction form must emit selected type to its page')
assert.match(source, /id="customer-package-credits"[^>]*type="number"[^>]*inputmode="decimal"[^>]*step="any"/, 'adjustments must permit fractional credits')
assert.match(source, /movementType === 'USAGE'[\s\S]*?usagePreview.items[\s\S]*?usagePreview.totalCredits/, 'usage must show computed item credits and total')
assert.match(source, /:max="deductingCredits \? remainingCredit : undefined"/, 'deducting credits input must be capped at the remaining balance')
assert.match(source, /v-if="deductingCredits"[^>]*:class="creditsOverBalance \? 'text-error' : 'text-on-surface-variant'"/, 'available-credit helper must be visible for deducting types and red when exceeded')
assert.match(source, /Only \$\{remainingCredit\} credits available.*\$\{remainingCredit\} credits available/, 'helper must distinguish an over-balance amount')
assert.match(source, /movementType === 'USAGE' \|\| movementType === 'REFUND'/, 'usage and refund must show the order picker')
assert.match(source, /empty-text="No orders for this customer"/, 'order picker must explain an empty list')
assert.match(source, /#option="\{ option \}"/, 'picker options must support custom rows')
assert.match(source, /id="customer-package-void-transaction"[\s\S]*?label="Transaction to void"/, 'void picker must identify the transaction being voided')
assert.match(source, /id="customer-package-target"[\s\S]*?label="Transfer to package"/, 'transfer picker must identify its destination')
assert.equal((source.match(/<template #option="\{ option \}">\s*<span class="flex min-w-0 flex-1 items-center justify-between gap-2">/g) ?? []).length, 2, 'order and transfer option rows must each have one full-width wrapper')
assert.match(source, /formatSheetDate\(order.receivedDate\)/, 'order rows must show a formatted received date')
assert.match(source, /serviceTypeLabel\(order.serviceType\)/, 'order rows must show service labels')
assert.match(source, /BaseBadge[^>]*size="sm" tone="brand"/, 'order rows must show a small brand service badge')
assert.match(source, /orderOption\(option\).quantity.*pcs/, 'order rows must show quantity at the right')
assert.match(source, /transaction.type !== 'PURCHASE' && transaction.type !== 'VOID'/, 'void picker must exclude purchase and void rows')
assert.match(source, /props.transactions.some\(\(item\) => item.type === 'VOID' && item.referenceId === transaction.id\)/, 'void picker must exclude already voided transactions')
assert.match(source, /Reverses .*credits →/, 'void must explain the reversal')
assert.match(source, /No credits left to expire/, 'empty packages must explain disabled expiry')
assert.match(source, /Transfers can't be saved yet\./, 'transfer must explain phase one limitation')
assert.match(source, /Notes \(required\)/, 'adjustment must require notes')
assert.doesNotMatch(source, /Credit movement|Reference source|Reference ID|Usage must be a negative|Refund must be a positive|customer-package-credit-change/, 'obsolete fields and sign guidance must be removed')
assert.match(source, /@submit="emit\('submit'\)"/, 'transaction form must delegate submit orchestration to its page')
assert.doesNotMatch(source, /(?:appendPackageTransaction|listWorkOrders\(|getCustomerPackages\(|\/api\/)/, 'presentational form must not call services or APIs')
assert.doesNotMatch(source, /value="PURCHASE"/, 'the type picker must not offer PURCHASE')

console.log('customer-package transaction-form dry tests passed')
