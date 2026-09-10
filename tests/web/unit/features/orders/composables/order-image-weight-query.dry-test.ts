import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
  assert.equal(readOrderImageWeight({ weight: String(MAX_ORDER_IMAGE_WEIGHT_KG) }), MAX_ORDER_IMAGE_WEIGHT_KG)
})

test('rejects every invalid weight so the camera cannot open', () => {
  for (const weight of ['', '   ', '0', '1e1', '1e-11', '0.10000000005', '-1', '20.55', '201', 'abc', 'NaN', 'Infinity']) {
    assert.equal(readOrderImageWeight({ weight }), null, weight)
  }
  assert.equal(readOrderImageWeight({}), null)
})

test('the weight prompt exposes the same one-decimal rule to the browser', () => {
  const source = readFileSync(
    new URL('../../../../../../src/features/orders/components/OrderImageWeightPrompt.vue', import.meta.url),
    'utf8',
  )

  assert.match(source, /step="0\.1"/)
  assert.match(source, /inputmode="decimal"/)
  assert.match(source, /@invalid="handleInvalid"/)
})

test('the prompt and the route share one validator', () => {
  for (const raw of ['20.5', '  20.5  ', '20.55', '', '0', '-1', '201', 'abc']) {
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
