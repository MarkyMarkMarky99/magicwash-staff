import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aspectRatiosMatch,
  clampPoint,
  nearestCornerIndex,
  warpOutputSize,
} from '@/features/orders/composables/use-corner-editor'
import type { Quad } from '@/features/orders/utils/quad-projection'

const quad: Quad = [
  { x: 100, y: 100 },
  { x: 900, y: 100 },
  { x: 900, y: 700 },
  { x: 100, y: 700 },
]

test('finds the nearest corner only within the supplied radius', () => {
  assert.equal(nearestCornerIndex(quad, { x: 120, y: 110 }, 30), 0)
  assert.equal(nearestCornerIndex(quad, { x: 500, y: 400 }, 30), null)
})

test('clamps a corner inside the image bounds', () => {
  assert.deepEqual(clampPoint({ x: -5, y: 1200 }, { width: 1000, height: 800 }), { x: 0, y: 800 })
})

test('accepts close aspect ratios and rejects mismatched preview and still ratios', () => {
  assert.equal(aspectRatiosMatch({ width: 2000, height: 1000 }, { width: 1920, height: 960 }), true)
  assert.equal(aspectRatiosMatch({ width: 4032, height: 3024 }, { width: 1920, height: 1080 }), false)
})

test('uses the longest opposing edges and caps the output size', () => {
  assert.deepEqual(warpOutputSize(quad, 2400), { width: 800, height: 600 })
  assert.deepEqual(warpOutputSize(quad, 400), { width: 400, height: 300 })
})
