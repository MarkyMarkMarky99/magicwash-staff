import assert from 'node:assert/strict'
import type { InvoicePriceListItemDto } from '../../../../../../src/features/invoices/services/invoice-price-list.service'
import {
  appendPickedLine,
  capGroupedItems,
  filterPriceListItems,
  formatBaht,
  formatEffectiveRange,
  groupPriceListByCategory,
  iconForCategory,
  isUnusedPlaceholderLine,
  toLineItemFormRow,
  uniqueCategories,
} from '../../../../../../src/features/invoices/utils/invoice-price-list.utils'
import { createSyntheticPlaceholderLine } from '../../../../../../src/features/invoices/types/invoice-create.types'

function item(overrides: Partial<InvoicePriceListItemDto> = {}): InvoicePriceListItemDto {
  return {
    id: 'pl-1',
    itemCode: 'ITM-0001',
    category: 'Bedding',
    subcategory: 'Pillows',
    itemType: 'Pillow',
    variant: 'Synthetic Fiber',
    displayNameTh: 'หมอนหนุนใยสังเคราะห์',
    displayNameEn: 'Synthetic Fiber Pillow',
    serviceType: 'WSIR',
    priceGroup: 'DEFAULT',
    unit: 'piece',
    price: 200,
    creditEligible: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    active: true,
    ...overrides,
  }
}

const picked = toLineItemFormRow(item({ price: 0 }))
assert.ok(picked)
assert.equal(picked.description.includes('WSIR'), true)
assert.equal(picked.description.includes('Synthetic Fiber Pillow'), false)
assert.equal(picked.unit, 'piece')
assert.equal(picked.unitOption, 'piece')
assert.equal(picked.quantity, '1')
assert.equal(picked.unitPrice, '0')
assert.deepEqual(picked.adjustments, [])

const customUnit = toLineItemFormRow(item({ unit: 'bag', price: 125 }))
assert.ok(customUnit)
assert.equal(customUnit.unitOption, 'custom')
assert.equal(customUnit.unit, 'bag')
assert.equal(customUnit.unitPrice, '125')

const sameItemDifferentPrices = [
  item({ id: 'a', price: 120 }),
  item({ id: 'b', price: 700 }),
]
assert.deepEqual(
  filterPriceListItems(sameItemDifferentPrices, { query: '', category: null }).map((row) => [row.id, row.price]),
  [['a', 120], ['b', 700]],
)

const englishSearch = filterPriceListItems(
  [item({ id: 'english', displayNameEn: 'King duvet cover' })],
  { query: 'duvet', category: null },
)
assert.deepEqual(englishSearch.map((row) => row.id), ['english'])

assert.equal(isUnusedPlaceholderLine(createSyntheticPlaceholderLine()), true)
assert.deepEqual(appendPickedLine([], picked), [picked])

const grouped = groupPriceListByCategory([
  item({ id: '1', category: 'Apparel' }),
  item({ id: '2', category: 'Bedding' }),
  item({ id: '3', category: 'Apparel' }),
])
assert.deepEqual(uniqueCategories(grouped.flatMap((group) => group.items)), ['Apparel', 'Bedding'])
assert.deepEqual(grouped.map((group) => [group.category, group.items.map((row) => row.id)]), [
  ['Apparel', ['1', '3']],
  ['Bedding', ['2']],
])

const capped = capGroupedItems([
  { category: 'A', items: [item({ id: '1' }), item({ id: '2' })] },
  { category: 'B', items: [item({ id: '3' })] },
], 2)
assert.equal(capped.truncated, true)
assert.equal(capped.renderedCount, 2)
assert.deepEqual(capped.groups.flatMap((group) => group.items.map((row) => row.id)), ['1', '2'])

assert.equal(iconForCategory('Mystery Future Category'), 'local_laundry_service')
assert.equal(formatEffectiveRange('2026-01-01', null), 'มีผล: 01 Jan 2026 – —')
assert.equal(formatBaht(0), '฿0')

console.log('invoice-price-list.utils.dry-test: OK')
