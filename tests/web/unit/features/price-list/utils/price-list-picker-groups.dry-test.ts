import assert from 'node:assert/strict'
import { groupItemTypes, groupVariants } from '../../../../../../src/features/price-list/utils/price-list-picker-groups.ts'

const rows = [
  { category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow', variant: 'Synthetic Fiber', price: 200 },
  { category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow', variant: 'Synthetic Fiber', price: 250 },
  { category: 'Bedding', subcategory: 'Pillows', itemType: 'Pillow', variant: 'Duck Down', price: 300 },
  { category: 'Bedding', subcategory: 'Toys', itemType: 'Pillow', variant: null, price: 120 },
]

const types = groupItemTypes(rows)
assert.equal(types.length, 2, 'itemType alone must not merge unrelated subcategories')
assert.deepEqual(types.map((group) => group.subcategory), ['Pillows', 'Toys'])

const pillowVariants = groupVariants(types[0]!.items)
assert.equal(pillowVariants.length, 2)
assert.deepEqual(pillowVariants.find((variant) => variant.key === 'Synthetic Fiber')?.items.map((item) => item.price), [200, 250],
  'multiple price options for one variant must remain selectable')

const toyVariants = groupVariants(types[1]!.items)
assert.equal(toyVariants[0]?.name, 'ทั่วไป')

console.log('price-list-picker-groups.dry-test: OK')
