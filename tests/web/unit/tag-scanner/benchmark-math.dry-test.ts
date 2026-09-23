import assert from 'node:assert/strict'
import test from 'node:test'
import { mapCoverRoi, percentile95 } from '../../../../src/features/tag-scanner/utils/benchmark-math'

test('maps a centered square through object-cover with horizontal cropping', () => {
  const roi = mapCoverRoi(1920, 1080, { x: 10, y: 20, width: 360, height: 640 }, { x: 110, y: 220, width: 160, height: 160 })
  assert.ok(Math.abs(roi.x - 825) < 0.001)
  assert.equal(roi.y, 337.5)
  assert.equal(roi.width, 270)
  assert.equal(roi.height, 270)
})

test('maps a centered square through object-cover with vertical cropping', () => {
  const roi = mapCoverRoi(1080, 1920, { x: 0, y: 0, width: 640, height: 360 }, { x: 240, y: 140, width: 160, height: 160 })
  assert.equal(roi.x, 405)
  assert.ok(Math.abs(roi.y - 892.5) < 0.001)
  assert.equal(roi.width, 270)
  assert.equal(roi.height, 270)
})

test('p95 uses the nearest rank over a sliding sample', () => {
  assert.equal(percentile95([]), null)
  assert.equal(percentile95([4]), 4)
  assert.equal(percentile95(Array.from({ length: 100 }, (_, index) => 100 - index)), 95)
})
