import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_AREA_RATIO,
  movementRatio,
  quadAreaRatio,
} from '@/features/orders/composables/use-hold-still-capture'
import type { Quad } from '@/features/orders/utils/quad-projection'

const quad: Quad = [
  { x: 100, y: 100 },
  { x: 900, y: 100 },
  { x: 900, y: 900 },
  { x: 100, y: 900 },
] as const

test('an identical quad has no movement', () => {
  assert.equal(movementRatio(quad, quad, 1000), 0)
})

test('scores the largest single-corner displacement', () => {
  const shifted: Quad = [quad[0], { x: 930, y: 140 }, quad[2], quad[3]]
  assert.equal(movementRatio(quad, shifted, 1000), 50 / 1000)
})

test('the same pixel shift has a lower ratio on a larger frame', () => {
  const shifted: Quad = [{ x: 110, y: 100 }, quad[1], quad[2], quad[3]]
  assert.ok(movementRatio(quad, shifted, 2000) < movementRatio(quad, shifted, 1000))
})

test('requires a quad to cover the minimum frame area', () => {
  const tinyQuad: Quad = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]

  assert.ok(quadAreaRatio(quad, 1000, 1000) >= MIN_AREA_RATIO)
  assert.ok(quadAreaRatio(tinyQuad, 1000, 1000) < MIN_AREA_RATIO)
})
