import assert from 'node:assert/strict'
import {
  createPriceListPayload,
  updatePriceListPayload,
} from '../../../../../../src/features/price-list/utils/price-list-form-payload'

const form = {
  itemCode: 'ITM-0010',
  category: 'Bedding',
  subcategory: 'Pillows',
  itemType: 'Pillow',
  variant: '',
  displayNameTh: 'หมอนหนุน',
  displayNameEn: '',
  serviceType: 'WSIR' as const,
  unit: '',
  price: '0',
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  active: true,
}

const expectedFields = {
  category: 'Bedding',
  subcategory: 'Pillows',
  itemType: 'Pillow',
  variant: null,
  displayNameTh: 'หมอนหนุน',
  displayNameEn: null,
  serviceType: 'WSIR',
  unit: null,
  price: 0,
  creditEligible: false,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
}

assert.deepEqual(createPriceListPayload({ ...form, itemCode: '' }, 'new'), { ...expectedFields, priceGroup: 'DEFAULT' })
assert.equal('itemCode' in createPriceListPayload({ ...form, itemCode: '' }, 'new'), false)

assert.deepEqual(
  createPriceListPayload(form, 'existing'),
  { itemCode: 'ITM-0010', ...expectedFields, priceGroup: 'DEFAULT' },
)

assert.deepEqual(updatePriceListPayload(form), expectedFields)
assert.equal('priceGroup' in updatePriceListPayload(form), false, 'editing must preserve an existing non-DEFAULT group')
assert.equal('itemCode' in updatePriceListPayload(form), false)

console.log('price-list-form-payload.dry-test: OK')
