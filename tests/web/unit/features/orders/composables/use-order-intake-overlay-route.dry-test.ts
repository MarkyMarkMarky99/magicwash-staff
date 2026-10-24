import assert from 'node:assert/strict'
import test from 'node:test'
import { parseOrderIntakeOverlay, serializeOrderIntakeOverlay, type OrderIntakeOverlay } from '@/features/orders/composables/useOrderIntakeOverlayRoute'

const overlays: OrderIntakeOverlay[] = [
  { kind: 'garments' },
  { kind: 'document' },
  { kind: 'weight' },
  { kind: 'belonging' },
  { kind: 'photos' },
  { kind: 'view', id: 'intake-3' },
  { kind: 'row', key: 'ITM-0007' },
  { kind: 'row', key: 'uncategorized' },
  { kind: 'pick', tag: 'AAAA0001' },
  { kind: 'defect', tag: 'AAAA0001' },
]

test('every overlay survives a round trip through the query value', () => {
  for (const overlay of overlays) assert.deepEqual(parseOrderIntakeOverlay(serializeOrderIntakeOverlay(overlay)), overlay)
})

test('unknown or empty values are not overlays', () => {
  for (const raw of [undefined, null, '', 'nope', 'row:', 'pick:', 'defect:', 'view:']) assert.equal(parseOrderIntakeOverlay(raw), null)
})

test('the first value of a repeated query key is used', () => {
  assert.deepEqual(parseOrderIntakeOverlay(['row:uncategorized', 'photos']), { kind: 'row', key: 'uncategorized' })
})
