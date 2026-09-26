import assert from 'node:assert/strict'
import test from 'node:test'
import { orderTotalWeightKg } from '@/features/orders/order-total-weight'

test('sums only WEIGHT image quantities and rounds the total to one decimal', () => {
  assert.equal(orderTotalWeightKg([
    { imageType: 'WEIGHT', quantity: 0.1 },
    { imageType: 'WEIGHT', quantity: 0.2 },
    { imageType: 'BELONGING', quantity: 8 },
    { imageType: 'DOCUMENT', quantity: null },
    { imageType: 'WEIGHT', quantity: null },
  ]), 0.3)
})

test('returns null when no WEIGHT image has a quantity', () => {
  assert.equal(orderTotalWeightKg([]), null)
  assert.equal(orderTotalWeightKg([{ imageType: 'WEIGHT', quantity: null }, { imageType: 'BELONGING', quantity: 5 }]), null)
})
