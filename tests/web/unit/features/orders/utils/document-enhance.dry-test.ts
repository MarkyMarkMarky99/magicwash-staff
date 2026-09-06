import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildIntegralImage,
  enhanceDocument,
  integralWindowSum,
} from '@/features/orders/utils/document-enhance'

function greyBuffer(values: number[], width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  values.forEach((value, index) => {
    data[index * 4] = value
    data[index * 4 + 1] = value
    data[index * 4 + 2] = value
    data[index * 4 + 3] = 255
  })
  return { data, width, height }
}

test('enhance keeps a uniform grey image uniform', () => {
  const result = enhanceDocument(greyBuffer(new Array(64).fill(128), 8, 8), 'enhance')
  const values = result.data.filter((_, index) => index % 4 === 0)
  assert.equal(new Set(values).size, 1)
})

test('enhance substantially flattens a brightness gradient', () => {
  const gradient = Array.from({ length: 64 }, (_, index) => 60 + (index % 8) * 20)
  const result = enhanceDocument(greyBuffer(gradient, 8, 8), 'enhance')
  const values = result.data.filter((_, index) => index % 4 === 0)
  assert.ok(Math.max(...values) - Math.min(...values) < 80)
})

test('integral windows match direct hand-computed sums', () => {
  const values = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const integral = buildIntegralImage(values, 3, 3)
  assert.equal(integralWindowSum(integral, 3, 1, 1, 3, 3), 28)
  assert.equal(integralWindowSum(integral, 3, 0, 0, 2, 2), 12)
})

test('original returns byte-identical pixels', () => {
  const input = greyBuffer([12, 34, 56, 78], 2, 2)
  assert.deepEqual(enhanceDocument(input, 'original').data, input.data)
})
