import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../../../src/${path}`, import.meta.url), 'utf8')
}

const row = source('features/invoices/components/InvoicePriceListItemRow.vue')
assert.match(row, /item/)
assert.match(row, /price/)
assert.doesNotMatch(row, /serviceKey|PriceListServiceKey/)
assert.doesNotMatch(row, /washDryIronPrice|ironOnlyPrice|dryCleanPrice/)
assert.match(row, /defineEmits|emit/)

const picker = source('features/invoices/components/InvoicePriceListPicker.vue')
assert.match(picker, /InvoicePriceListItemRow/)
assert.doesNotMatch(picker, /serviceKey|PriceListServiceKey/)
assert.match(picker, /select/)

const createPage = source('features/invoices/pages/InvoiceCreatePage.vue')
assert.match(createPage, /InvoicePriceListPicker/)
assert.match(createPage, /pick-from-price-list|openPriceListPicker/)
assert.doesNotMatch(createPage, /serviceKey|PriceListServiceKey/)

const editor = source('features/invoices/components/InvoiceLineItemsEditor.vue')
assert.match(editor, /pickFromPriceList/)
assert.doesNotMatch(editor, /InvoicePriceListPicker/)
assert.match(editor, /itemQuantityStep\(line\.unit\)/)
assert.match(editor, /isWeightUnit\(line\.unit\)/)
assert.doesNotMatch(editor, /line\.quantity[\s\S]{0,120}step="any"/)

assert.match(createPage, /isValidItemQuantity\(item\.quantity, item\.unit\)/)
assert.match(createPage, /const unit = item\.unit\?\.trim\(\) \|\| 'piece'/)

const contextService = source('features/invoices/services/invoice-create-context.service.ts')
assert.match(contextService, /\/api\/work-orders\//)
assert.doesNotMatch(contextService, /\/api\/orders/)

console.log('invoice-price-list-components.dry-test: OK')
