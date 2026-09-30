import assert from 'node:assert/strict'
import type { PriceListDto } from '../../../../../../src/data/price-list/price-list.service'
import { priceListValueLabel, rowsForPriceListView } from '../../../../../../src/features/price-list/utils/price-list-view'

const rows = [
  { id: 'normal', priceGroup: 'DEFAULT', price: 75, unit: 'piece', active: true },
  { id: 'credit', priceGroup: 'CREDIT', price: 1.5, unit: 'kg', active: true },
  { id: 'inactive-credit', priceGroup: 'CREDIT', price: 2, unit: 'set', active: false },
] as PriceListDto[]

assert.deepEqual(rowsForPriceListView(rows, 'PRICE').map((row) => row.id), ['normal'])
assert.deepEqual(rowsForPriceListView(rows, 'CREDIT').map((row) => row.id), ['credit'])
assert.equal(priceListValueLabel(rows[1]!), '1.5 เครดิต / kg')
assert.equal(priceListValueLabel({ price: 2, priceGroup: 'CREDIT', unit: null }), '2 เครดิต / —')
assert.equal(priceListValueLabel(rows[0]!), '฿75')

console.log('price-list-view.dry-test: OK')
