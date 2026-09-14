import assert from 'node:assert/strict'
import type { PriceListDto } from '../../../../../../src/data/price-list/price-list.service'
import {
  appendPickedLine,
  filterInvoicePriceListItems,
  invoiceUnitOptionFor,
  isUnusedPlaceholderLine,
  toLineItemFormRow,
} from '../../../../../../src/features/invoices/utils/invoice-price-list.utils'
import { createSyntheticPlaceholderLine } from '../../../../../../src/features/invoices/types/invoice-create.types'

function item(overrides: Partial<PriceListDto> = {}): PriceListDto {
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
    imageUrl: null,
    ...overrides,
  }
}

const picked = toLineItemFormRow(item({ price: 0 }))
assert.ok(picked)

assert.deepEqual(
  filterInvoicePriceListItems([
    item({ id: 'active' }),
    item({ id: 'inactive', active: false }),
    item({ id: 'other-group', priceGroup: 'VIP' }),
  ]).map((entry) => entry.id),
  ['active'],
)
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
assert.equal(invoiceUnitOptionFor('kg'), 'kg')
assert.equal(invoiceUnitOptionFor('bag'), 'custom')

assert.equal(isUnusedPlaceholderLine(createSyntheticPlaceholderLine()), true)
assert.deepEqual(appendPickedLine([], picked), [picked])

console.log('invoice-price-list.utils.dry-test: OK')
