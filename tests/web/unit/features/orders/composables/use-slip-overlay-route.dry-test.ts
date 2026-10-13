import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSlipOverlay, serializeSlipOverlay } from '@/features/orders/composables/useSlipOverlayRoute'

test('round-trips every slip overlay through the query value', () => {
  for (const overlay of [
    { kind: 'scan', retakeId: null },
    { kind: 'scan', retakeId: 'slip-2' },
    { kind: 'view', id: 'slip-3' },
  ] as const) {
    assert.deepEqual(parseSlipOverlay(serializeSlipOverlay(overlay)), overlay)
  }
})

test('ignores missing, empty and unknown query values', () => {
  assert.equal(parseSlipOverlay(undefined), null)
  assert.equal(parseSlipOverlay(''), null)
  assert.equal(parseSlipOverlay('view:'), null)
  assert.equal(parseSlipOverlay('retake:'), null)
  assert.equal(parseSlipOverlay('other'), null)
  assert.deepEqual(parseSlipOverlay(['scan', 'view:slip-1']), { kind: 'scan', retakeId: null })
})
