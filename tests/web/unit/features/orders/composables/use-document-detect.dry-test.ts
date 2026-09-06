import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isUsableDocumentQuad,
  smoothQuad,
  updateTemporalQuad,
} from '@/features/orders/composables/use-document-detect'
import type { TemporalQuadState } from '@/features/orders/composables/use-document-detect'
import type { Quad } from '@/features/orders/utils/quad-projection'

const baseQuad: Quad = [
  { x: 100, y: 100 },
  { x: 900, y: 100 },
  { x: 900, y: 900 },
  { x: 100, y: 900 },
]

function state(quad: Quad | null): TemporalQuadState {
  return { quad, consecutiveJumps: 0, consecutiveMisses: 0 }
}

test('an identical quad smooths to itself', () => {
  assert.deepEqual(smoothQuad(baseQuad, baseQuad), baseQuad)
})

test('a small move converges toward the new position', () => {
  const moved = baseQuad.map((point) => ({ x: point.x + 20, y: point.y + 10 })) as Quad
  const smoothed = smoothQuad(baseQuad, moved)
  assert.deepEqual(smoothed[0], { x: 107, y: 103.5 })
  assert.ok(smoothed[0].x > baseQuad[0].x && smoothed[0].x < moved[0].x)
})

test('a huge jump is rejected once and accepted on the second consecutive occurrence', () => {
  const jumped = baseQuad.map((point) => ({ x: point.x + 400, y: point.y })) as Quad
  const first = updateTemporalQuad(state(baseQuad), jumped, 1000)
  assert.deepEqual(first.quad, baseQuad)
  assert.equal(first.consecutiveJumps, 1)

  const second = updateTemporalQuad(first, jumped, 1000)
  assert.deepEqual(second.quad, jumped)
  assert.equal(second.consecutiveJumps, 0)
})

test('misses below the tolerance keep the previous quad', () => {
  const first = updateTemporalQuad(state(baseQuad), null, 1000)
  const second = updateTemporalQuad(first, null, 1000)
  assert.deepEqual(first.quad, baseQuad)
  assert.deepEqual(second.quad, baseQuad)

  const third = updateTemporalQuad(second, null, 1000)
  assert.equal(third.quad, null)
})

test('rejects a frame-hugging quad and accepts an inset document', () => {
  const frame = { x: 0, y: 0, width: 1000, height: 800 }
  assert.equal(isUsableDocumentQuad([
    { x: 2, y: 2 },
    { x: 998, y: 2 },
    { x: 998, y: 798 },
    { x: 2, y: 798 },
  ], frame), false)
  assert.equal(isUsableDocumentQuad([
    { x: 150, y: 100 },
    { x: 850, y: 110 },
    { x: 820, y: 700 },
    { x: 170, y: 690 },
  ], frame), true)
})
