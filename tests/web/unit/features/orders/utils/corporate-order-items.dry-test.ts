import assert from 'node:assert/strict'
import test from 'node:test'
import type { PriceListDto } from '@/data/price-list/price-list.service'
import { corporateOrderItems } from '@/features/orders/utils/corporate-order-items'

function row(overrides: Partial<PriceListDto>): PriceListDto {
  return {
    id: 'PL-1',
    itemCode: 'ITM-0001',
    category: 'LINEN',
    subcategory: 'Towels',
    itemType: 'Towel',
    variant: null,
    displayNameTh: 'ผ้าเช็ดตัว',
    displayNameEn: 'Bath towel',
    serviceType: 'WASH',
    priceGroup: 'HOTEL',
    unit: null,
    price: 10,
    creditEligible: false,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    active: true,
    imageUrl: null,
    ...overrides,
  }
}

test('keeps only active rows of the customer price group', () => {
  const items = corporateOrderItems('HOTEL', [
    row({ id: 'a', itemCode: 'ITM-0001' }),
    row({ id: 'b', itemCode: 'ITM-0002', priceGroup: 'DEFAULT' }),
    row({ id: 'c', itemCode: 'ITM-0003', active: false }),
  ])
  assert.deepEqual(items.map((item) => item.itemCode), ['ITM-0001'])
})

test('shows an item code once however many rows carry it', () => {
  const items = corporateOrderItems('HOTEL', [
    row({ id: 'a', serviceType: 'WASH' }),
    row({ id: 'b', serviceType: 'IRON' }),
    row({ id: 'c', itemCode: 'ITM-0002', serviceType: 'WASH' }),
  ])
  assert.deepEqual(items.map((item) => item.itemCode), ['ITM-0001', 'ITM-0002'])
})

test('a later duplicate fills a missing name or image but never replaces one', () => {
  const [item] = corporateOrderItems('HOTEL', [
    row({ id: 'a', displayNameEn: null, imageUrl: null }),
    row({ id: 'b', displayNameEn: 'Bath towel', imageUrl: 'https://example.test/a.png' }),
    row({ id: 'c', displayNameEn: 'Other', imageUrl: 'https://example.test/b.png' }),
  ])
  assert.equal(item!.nameEn, 'Bath towel')
  assert.equal(item!.imageUrl, 'https://example.test/a.png')
  assert.equal(item!.nameTh, 'ผ้าเช็ดตัว')
})

test('a customer without a price group gets no items', () => {
  const rows = [row({ priceGroup: '' }), row({ id: 'b' })]
  assert.deepEqual(corporateOrderItems(null, rows), [])
  assert.deepEqual(corporateOrderItems(undefined, rows), [])
  assert.deepEqual(corporateOrderItems('   ', rows), [])
})

test('a group with no matching rows gets no items', () => {
  assert.deepEqual(corporateOrderItems('SPA', [row({})]), [])
})
