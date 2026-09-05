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

console.log('invoice-price-list-components.dry-test: OK')
