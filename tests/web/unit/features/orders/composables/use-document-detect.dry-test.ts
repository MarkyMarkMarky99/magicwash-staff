import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isUsableDocumentQuad,
  letterboxLayout,
  smoothQuad,
  unmapLetterboxedQuad,
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

// --- letterbox mapping ---------------------------------------------------
// This is the one piece of detection maths with no visible failure: get it wrong and the
// outline sits beside the document instead of on it, with a green build and no error.

test('a portrait frame is centred between vertical bars, filling the height', () => {
  const layout = letterboxLayout(2160, 3840, 224)
  assert.equal(layout.drawHeight, 224)
  assert.equal(layout.offsetY, 0)
  assert.ok(Math.abs(layout.drawWidth - 126) < 0.5)
  // The bars split evenly, so the drawn frame stays centred.
  assert.ok(Math.abs(layout.offsetX * 2 + layout.drawWidth - 224) < 1e-9)
})

test('a landscape frame is centred between horizontal bars, filling the width', () => {
  const layout = letterboxLayout(3840, 2160, 224)
  assert.equal(layout.drawWidth, 224)
  assert.equal(layout.offsetX, 0)
  assert.ok(Math.abs(layout.offsetY * 2 + layout.drawHeight - 224) < 1e-9)
})

test('a square frame needs no bars at all', () => {
  const layout = letterboxLayout(1000, 1000, 224)
  assert.deepEqual(
    { x: layout.offsetX, y: layout.offsetY },
    { x: 0, y: 0 },
  )
  assert.equal(layout.drawWidth, 224)
})

test('a frame smaller than the model input is not upscaled', () => {
  // fitScale caps at 1, so a tiny frame is padded rather than blown up.
  const layout = letterboxLayout(100, 80, 224)
  assert.equal(layout.scale, 1)
  assert.equal(layout.drawWidth, 100)
  assert.equal(layout.offsetX, 62)
})

test('unmapping returns a quad to the exact video pixels it came from', () => {
  for (const [width, height] of [[2160, 3840], [3840, 2160], [1920, 1080], [1000, 1000]]) {
    const layout = letterboxLayout(width, height, 224)
    const original: Quad = [
      { x: width * 0.1, y: height * 0.15 },
      { x: width * 0.9, y: height * 0.12 },
      { x: width * 0.88, y: height * 0.8 },
      { x: width * 0.12, y: height * 0.85 },
    ]
    // Forward: exactly what drawImage does to a point in the source frame.
    const drawn = original.map((point) => ({
      x: point.x * layout.scale + layout.offsetX,
      y: point.y * layout.scale + layout.offsetY,
    })) as Quad
    const restored = unmapLetterboxedQuad(drawn, layout)
    restored.forEach((point, index) => {
      assert.ok(Math.abs(point.x - original[index].x) < 1e-6, `x drifted at ${width}x${height}`)
      assert.ok(Math.abs(point.y - original[index].y) < 1e-6, `y drifted at ${width}x${height}`)
    })
  }
})

test('a corner on the black bar maps outside the video frame, not onto its edge', () => {
  // A model corner landing in the padding is out of bounds and must stay out of bounds,
  // so isUsableDocumentQuad can reject it rather than silently clamping it to the edge.
  const layout = letterboxLayout(2160, 3840, 224)
  const onLeftBar: Quad = [
    { x: 0, y: 10 },
    { x: 200, y: 10 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ]
  const mapped = unmapLetterboxedQuad(onLeftBar, layout)
  assert.ok(mapped[0].x < 0)
  assert.ok(mapped[3].x < 0)
})
