import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contentBox,
  fitScale,
  orderQuad,
  projectQuad,
  scaleQuad,
} from '@/features/orders/utils/quad-projection'

test('letterboxes a landscape video in a portrait element and a portrait video in a landscape element', () => {
  const landscapeInPortrait = contentBox(1920, 1080, 360, 640)
  assert.equal(landscapeInPortrait.scale, 360 / 1920)
  assert.equal(landscapeInPortrait.offsetX, 0)
  assert.ok(landscapeInPortrait.offsetY > 0)

  const portraitInLandscape = contentBox(1080, 1920, 640, 360)
  assert.equal(portraitInLandscape.scale, 360 / 1920)
  assert.ok(portraitInLandscape.offsetX > 0)
  assert.equal(portraitInLandscape.offsetY, 0)
})

test('has no offsets when video and element share an aspect ratio', () => {
  const box = contentBox(1920, 1080, 640, 360)
  assert.equal(box.offsetX, 0)
  assert.equal(box.offsetY, 0)
})

test('does not upscale an image already under the processing cap', () => {
  assert.equal(fitScale(800, 600, 1000), 1)
})

test('scales and projects a quad with expected arithmetic', () => {
  const workQuad = scaleQuad([
    { x: 100, y: 50 },
    { x: 300, y: 50 },
    { x: 300, y: 250 },
    { x: 100, y: 250 },
  ], 2)

  assert.deepEqual(projectQuad(workQuad, { scale: 0.5, offsetX: 10, offsetY: 20 }), [
    { x: 110, y: 70 },
    { x: 310, y: 70 },
    { x: 310, y: 270 },
    { x: 110, y: 270 },
  ])
})

test('orders rotated and reversed points consistently', () => {
  const expected = [
    { x: 10, y: 20 },
    { x: 80, y: 10 },
    { x: 90, y: 90 },
    { x: 20, y: 100 },
  ]

  assert.deepEqual(orderQuad([expected[2], expected[3], expected[0], expected[1]]), expected)
  assert.deepEqual(orderQuad([expected[3], expected[2], expected[1], expected[0]]), expected)
})

test('zero and invalid dimensions return neutral finite values', () => {
  for (const box of [contentBox(0, 1080, 360, 640), contentBox(NaN, 1080, 360, 640)]) {
    assert.deepEqual(box, { scale: 1, offsetX: 0, offsetY: 0 })
    assert.ok(Object.values(box).every(Number.isFinite))
  }
  assert.equal(fitScale(0, 1080, 1000), 1)
})
