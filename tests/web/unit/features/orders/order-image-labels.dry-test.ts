import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOrderImageTypeLabel,
  ORDER_IMAGE_TYPES,
  orderImageTypeIcons,
  orderImageTypeLabels,
} from '@/features/orders/order-image-labels'
import {
  imageTypeToOverlay,
  overlayToImageType,
} from '@/features/orders/composables/use-order-overlay-route'

test('labels the three writable types', () => {
  assert.deepEqual(ORDER_IMAGE_TYPES, ['WEIGHT', 'BELONGING', 'DOCUMENT'])
  assert.deepEqual(Object.keys(orderImageTypeLabels), ['WEIGHT', 'BELONGING', 'DOCUMENT'])
  assert.deepEqual(Object.keys(orderImageTypeIcons), ['WEIGHT', 'BELONGING', 'DOCUMENT'])
})

test('falls back for legacy and blank types', () => {
  assert.equal(getOrderImageTypeLabel('WEIGHT'), 'น้ำหนัก')
  assert.equal(getOrderImageTypeLabel('BAG'), 'BAG')
  assert.equal(getOrderImageTypeLabel('BAGS / BASKETS'), 'BAGS / BASKETS')
  assert.equal(getOrderImageTypeLabel(null), 'อื่นๆ')
  assert.equal(getOrderImageTypeLabel('   '), 'อื่นๆ')
})

test('the overlay maps are exact inverses', () => {
  for (const imageType of ORDER_IMAGE_TYPES) {
    assert.equal(overlayToImageType[imageTypeToOverlay[imageType]], imageType)
  }
})
