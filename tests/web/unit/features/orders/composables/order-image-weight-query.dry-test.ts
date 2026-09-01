import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOrderOverlayQuery,
  MAX_ORDER_IMAGE_WEIGHT_KG,
  parseOrderImageWeight,
  readOrderImageWeight,
} from '@/features/orders/composables/use-order-overlay-route'

test('reads a valid weight from the route', () => {
  assert.equal(readOrderImageWeight({ weight: '20.5' }), 20.5)
  assert.equal(readOrderImageWeight({ weight: '  20.5  ' }), 20.5)
  assert.equal(readOrderImageWeight({ weight: '20.567' }), 20.57)
  assert.equal(readOrderImageWeight({ weight: String(MAX_ORDER_IMAGE_WEIGHT_KG) }), MAX_ORDER_IMAGE_WEIGHT_KG)
})

test('rejects every invalid weight so the camera cannot open', () => {
  for (const weight of ['', '   ', '0', '-1', '201', 'abc', 'NaN', 'Infinity']) {
    assert.equal(readOrderImageWeight({ weight }), null, weight)
  }
  assert.equal(readOrderImageWeight({}), null)
})

test('the prompt and the route share one validator', () => {
  for (const raw of ['20.5', '  20.5  ', '20.567', '', '0', '-1', '201', 'abc']) {
    assert.equal(parseOrderImageWeight(raw), readOrderImageWeight({ weight: raw }), raw)
  }
})

test('opening an overlay drops a stale weight', () => {
  assert.deepEqual(
    buildOrderOverlayQuery({ weight: '20.5', orderAction: 'photo-weight' }, 'photo-weight'),
    { orderAction: 'photo-weight' },
  )
  assert.deepEqual(
    buildOrderOverlayQuery({ page: '2', weight: '20.5', orderAction: 'photo-weight' }, null),
    { page: '2' },
  )
})
