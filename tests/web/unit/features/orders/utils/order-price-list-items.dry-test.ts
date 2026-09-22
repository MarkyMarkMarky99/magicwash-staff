import assert from 'node:assert/strict'
import type { PriceListDto } from '@/data/price-list/price-list.service'
import { filterOrderPriceListItems } from '@/features/orders/utils/order-price-list-items'

const row = (id: string, overrides: Partial<PriceListDto> = {}): PriceListDto => ({
  id,
  itemCode: id,
  category: 'Clothing',
  subcategory: 'Shirts',
  itemType: 'Shirt',
  variant: null,
  displayNameTh: 'เสื้อ',
  displayNameEn: 'Shirt',
  serviceType: 'WSIR',
  priceGroup: 'DEFAULT',
  unit: 'ชิ้น',
  price: 35.5,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
  imageUrl: null,
  ...overrides,
})

const items = [
  row('first', { active: false, priceGroup: 'VIP' }),
  row('other-service', { serviceType: 'DRCL' }),
  row('other-group', { priceGroup: 'VIP' }),
  row('first-default', { itemCode: 'first', active: false }),
  row('first-active', { itemCode: 'first', serviceType: 'IRON' }),
  row('inactive', { active: false }),
  row('last'),
]

assert.deepEqual(
  filterOrderPriceListItems(items).map((item) => item.id),
  ['first-active', 'other-service', 'other-group', 'inactive', 'last'],
  'each item code appears once, including other services, groups, and inactive-only codes',
)

console.log('order-price-list-items.dry-test: OK')
