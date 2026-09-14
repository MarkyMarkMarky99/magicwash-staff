import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const picker = source('features/price-list/components/PriceListItemPicker.vue')
assert.match(picker, /size="full"/)
assert.match(picker, /<PickerOverlay/)
assert.match(picker, /<DetailOverlay/)
assert.match(picker, /step === 'variant'/)
assert.match(picker, /stepTransition/)
assert.match(picker, /item\.variant/)
assert.match(picker, /selectOption\(item\)/)
assert.doesNotMatch(picker, /serviceKey|PriceListServiceKey/)

const createPage = source('features/invoices/pages/InvoiceCreatePage.vue')
assert.match(createPage, /PriceListItemPicker/)
assert.match(createPage, /pick-from-price-list|openPriceListPicker/)
assert.doesNotMatch(createPage, /serviceKey|PriceListServiceKey/)

const editor = source('features/invoices/components/InvoiceLineItemsEditor.vue')
assert.match(editor, /pickFromPriceList/)
assert.doesNotMatch(editor, /PriceListItemPicker/)
assert.match(editor, /itemQuantityStep\(line\.unit\)/)
assert.match(editor, /isWeightUnit\(line\.unit\)/)
assert.doesNotMatch(editor, /line\.quantity[\s\S]{0,120}step="any"/)

assert.match(createPage, /isValidItemQuantity\(item\.quantity, item\.unit\)/)
assert.match(createPage, /const unit = item\.unit\?\.trim\(\) \|\| 'piece'/)

const contextService = source('features/invoices/services/invoice-create-context.service.ts')
const workOrderService = source('data/work-orders/work-order.service.ts')
assert.match(contextService, /getWorkOrder\(orderId\)/)
assert.match(workOrderService, /\/api\/work-orders/)
assert.doesNotMatch(contextService, /\/api\/orders/)

console.log('invoice-price-list-components.dry-test: OK')
