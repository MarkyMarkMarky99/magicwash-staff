import assert from 'node:assert/strict'
import { defaultWashOptions, washOptionLabels } from '../../src/features/wash-queue/wash-options'
import type { WashProductDto } from '../../src/data/wash-products/wash-products.service'

const product = (id: string, type: WashProductDto['type'], sortOrder: number | null, status: WashProductDto['status'] = 'ACTIVE'): WashProductDto => ({
  id, type, sortOrder, status, name: `Name ${id}`, note: null,
})
const products = [
  product('DET-04', 'DETERGENT', null), product('DET-03', 'DETERGENT', 2),
  product('DET-02', 'DETERGENT', 1), product('DET-01', 'DETERGENT', 1),
  product('DET-05', 'DETERGENT', -1, 'INACTIVE'), product('SOF-01', 'SOFTENER', -2),
  product('BLC-01', 'BLEACH', -3),
]
const original = [...products]
const defaults = defaultWashOptions(products)
assert.deepEqual(defaults, {
  preRinse: false, soakMinutes: null, extraWash: false, temperature: 'cold',
  bleach: null, detergent: 'DET-01', softener: null, rinses: 2,
})
assert.deepEqual(products, original, 'does not sort the input array')
assert.equal(defaultWashOptions([]).detergent, null)
assert.equal(defaultWashOptions(products.filter(product => product.status === 'INACTIVE' || product.type !== 'DETERGENT')).detergent, null)
assert.equal(defaultWashOptions([product('DET-04', 'DETERGENT', null)]).detergent, 'DET-04')
defaults.preRinse = true
assert.equal(defaultWashOptions(products).preRinse, false, 'fresh object for each booking')
const nameOf = (id: string) => products.find(product => product.id === id)?.name ?? id
assert.deepEqual(washOptionLabels(defaultWashOptions([]), nameOf), ['Rinse 2'])
assert.deepEqual(washOptionLabels(defaultWashOptions(products), nameOf), ['Name DET-01', 'Rinse 2'])
assert.deepEqual(washOptionLabels({
  ...defaults, preRinse: true, soakMinutes: 720, extraWash: true, temperature: '60',
  bleach: 'BLC-01', detergent: 'DET-05', softener: 'SOF-01', rinses: 3,
}, nameOf), ['Pre-rinse', 'Soak 720 min', 'Extra wash', '60°C', 'Name BLC-01', 'Name DET-05', 'Name SOF-01', 'Rinse 3'])
assert.deepEqual(washOptionLabels({ ...defaultWashOptions([]), temperature: '40', soakMinutes: 1, bleach: 'missing', rinses: 1 }, nameOf), ['Soak 1 min', '40°C', 'missing', 'Rinse 1'])
console.log('wash options dry test passed (defaults, active product ordering, fresh objects, labels, inactive names, fallback IDs)')
