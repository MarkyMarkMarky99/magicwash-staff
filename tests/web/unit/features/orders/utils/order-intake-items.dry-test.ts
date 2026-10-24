import assert from 'node:assert/strict'
import test from 'node:test'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'
import { groupOrderIntakeGarments, orderIntakeItemName } from '@/features/orders/utils/order-intake-items'

const catalog = [
  { id: 'i-shirt', displayNameTh: 'เสื้อเชิ้ต', displayNameEn: 'Shirt' },
  { id: 'i-dress', displayNameTh: 'ชุดเดรส', displayNameEn: 'Dress' },
  { id: 'i-th', displayNameTh: 'ผ้าห่ม', displayNameEn: '  ' },
]

function garment(tag: string, itemId: string | null): OrderIntakeGarment {
  return { tag, itemId, imageUrl: null, note: null, defectPhotos: [] }
}

test('names come from English, falling back to Thai when English is blank', () => {
  assert.equal(orderIntakeItemName(catalog[0]!), 'Shirt')
  assert.equal(orderIntakeItemName(catalog[2]!), 'ผ้าห่ม')
})

test('no garments gives no rows and a zero total', () => {
  assert.deepEqual(groupOrderIntakeGarments([], catalog), { rows: [], total: 0 })
})

test('groups by item id with the garment count, sorted by name', () => {
  const { rows, total } = groupOrderIntakeGarments([
    garment('AAAA0001', 'i-shirt'),
    garment('AAAA0002', 'i-dress'),
    garment('AAAA0003', 'i-shirt'),
  ], catalog)
  assert.equal(total, 3)
  assert.deepEqual(rows.map((row) => [row.key, row.name, row.garments.length, row.uncategorized]), [
    ['i-dress', 'Dress', 1, false],
    ['i-shirt', 'Shirt', 2, false],
  ])
  assert.deepEqual(rows[1]!.garments.map((entry) => entry.tag), ['AAAA0001', 'AAAA0003'])
})

test('null and unknown item ids gather in a last Uncategorized row', () => {
  const { rows, total } = groupOrderIntakeGarments([
    garment('AAAA0001', null),
    garment('AAAA0002', 'i-shirt'),
    garment('AAAA0003', 'gone'),
  ], catalog)
  assert.equal(total, 3)
  assert.deepEqual(rows.map((row) => [row.key, row.uncategorized, row.garments.length]), [
    ['i-shirt', false, 1],
    ['uncategorized', true, 2],
  ])
  assert.equal(rows.at(-1)!.itemId, null)
  assert.equal(rows.at(-1)!.name, 'Uncategorized')
})

test('an empty catalog puts every garment in Uncategorized', () => {
  const { rows } = groupOrderIntakeGarments([garment('AAAA0001', 'i-shirt')], [])
  assert.deepEqual(rows.map((row) => row.key), ['uncategorized'])
})

test('Uncategorized is absent when every garment has a known type', () => {
  const { rows } = groupOrderIntakeGarments([garment('AAAA0001', 'i-shirt')], catalog)
  assert.equal(rows.some((row) => row.uncategorized), false)
})

test('changing a garment type moves it to the other row and drops an emptied one', () => {
  const garments = [garment('AAAA0001', 'i-shirt'), garment('AAAA0002', 'i-shirt')]
  garments[0]!.itemId = 'i-dress'
  assert.deepEqual(groupOrderIntakeGarments(garments, catalog).rows.map((row) => [row.key, row.garments.length]), [['i-dress', 1], ['i-shirt', 1]])
  garments[1]!.itemId = 'i-dress'
  assert.deepEqual(groupOrderIntakeGarments(garments, catalog).rows.map((row) => [row.key, row.garments.length]), [['i-dress', 2]])
})
