import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildOrderOverlayQuery,
  readOrderOverlay,
} from '@/features/orders/composables/use-order-overlay-route'

const detailPageSource = readFileSync(
  new URL('../../../../../../src/features/orders/pages/OrderDetailPage.vue', import.meta.url),
  'utf8',
)

test('reads the single orderAction query as the overlay source of truth', () => {
  assert.equal(readOrderOverlay({ orderAction: 'item' }), 'item')
  assert.equal(readOrderOverlay({ orderAction: 'capture' }), 'capture')
  assert.equal(readOrderOverlay({ orderAction: 'unknown' }), null)
})

test('keeps old deep links usable without opening two overlays', () => {
  assert.equal(readOrderOverlay({ item: 'new' }), 'item')
  assert.equal(readOrderOverlay({ capture: '1' }), 'capture')
  assert.equal(readOrderOverlay({ item: 'new', capture: '1' }), 'capture')
})

test('opening an overlay removes every conflicting current and legacy flag', () => {
  assert.deepEqual(
    buildOrderOverlayQuery(
      { keyword: 'shirt', item: 'new', capture: '1', orderAction: 'capture' },
      'item',
    ),
    { keyword: 'shirt', orderAction: 'item' },
  )
})

test('closing an overlay strips overlay state while preserving unrelated query state', () => {
  assert.deepEqual(
    buildOrderOverlayQuery(
      { page: '2', item: 'new', capture: '1', orderAction: 'capture' },
      null,
    ),
    { page: '2' },
  )
})

test('the detail page unwraps nested computed flags before passing them to Boolean props', () => {
  assert.match(detailPageSource, /reactive\(useOrderOverlayRoute\(\)\)/)
  assert.doesNotMatch(detailPageSource, /const orderOverlay = useOrderOverlayRoute\(\)/)
})
