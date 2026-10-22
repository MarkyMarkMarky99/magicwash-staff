import assert from 'node:assert/strict'
import {
  buildPriceListCards,
  countPriceListRows,
  retailPriceRows,
} from '../../../../../../src/features/price-list/utils/price-list-table.ts'

type Row = Parameters<typeof retailPriceRows>[0][number]

let next = 0
function row(fields: Partial<Row>): Row {
  next += 1
  return {
    id: `P${next}`, itemCode: `ITM-${next}`, category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow', variant: null,
    displayNameTh: 'หมอน', displayNameEn: 'Pillow', serviceType: 'WSIR', priceGroup: 'DEFAULT', unit: 'piece', price: 100,
    creditEligible: true, effectiveFrom: '2026-01-01', effectiveTo: null, active: true, imageUrl: null, ...fields,
  }
}

const rows = [
  row({ serviceType: 'WSIR', price: 45, displayNameTh: 'เสื้อเชิ้ต', displayNameEn: 'Shirt', category: 'Clothing', subcategory: 'Tops' }),
  row({ serviceType: 'IRON', price: 20, displayNameTh: 'เสื้อเชิ้ต', displayNameEn: 'Shirt', category: 'Clothing', subcategory: 'Tops' }),
  row({ serviceType: 'WASH', price: 250, displayNameTh: 'ตุ๊กตา', displayNameEn: 'Stuffed Toy Pillow', subcategory: 'Toys' }),
  row({ serviceType: 'WASH', price: 300, displayNameTh: 'ตุ๊กตา', displayNameEn: 'Stuffed Toy Pillow', subcategory: 'Toys' }),
  row({ serviceType: 'WSIR', price: 120, displayNameTh: 'ปลอกหมอน', variant: 'Pillow', subcategory: 'Bedding Covers', unit: 'set' }),
  row({ serviceType: 'WSIR', price: 999, displayNameTh: 'ราคาองค์กร', priceGroup: 'CORPORATE' }),
  row({ serviceType: 'WSIR', price: 999, displayNameTh: 'ปิดใช้งาน', active: false }),
]

const retail = retailPriceRows(rows)
assert.equal(retail.length, 5, 'inactive rows and non-DEFAULT price groups never appear')

const all = buildPriceListCards(retail, null)
assert.deepEqual(all.map((card) => card.subcategory), ['Tops', 'Toys', 'Bedding Covers'])

const tops = all[0]!
assert.equal(tops.rows.length, 1, 'same Thai name and variant across services merge into one row')
assert.deepEqual(tops.services, ['WSIR', 'IRON'], 'only the services the card has, in fixed order')
assert.equal(tops.rows[0]!.prices.WSIR?.price, 45)
assert.equal(tops.rows[0]!.prices.IRON?.price, 20)
assert.equal(tops.rows[0]!.prices.WASH, undefined)
assert.equal(tops.rows[0]!.secondLine, 'Shirt · (pc)')

const toys = all[1]!
assert.equal(toys.rows.length, 2, 'two prices for the same service stay as separate rows')
assert.deepEqual(toys.rows.map((entry) => entry.prices.WASH?.price), [250, 300])

assert.equal(all[2]!.rows[0]!.variant, 'Pillow')
assert.equal(all[2]!.rows[0]!.secondLine, 'Pillow · (set)')
assert.equal(countPriceListRows(all), 4)

const washOnly = buildPriceListCards(retail, 'WASH')
assert.deepEqual(washOnly.map((card) => card.subcategory), ['Toys'])
assert.deepEqual(washOnly[0]!.services, ['WASH'])

console.log('price-list-table.dry-test: OK')
