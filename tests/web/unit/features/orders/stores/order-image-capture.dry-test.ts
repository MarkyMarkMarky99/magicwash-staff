import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const storeSource = readFileSync(
  new URL('../../../../../../src/features/orders/stores/order.store.ts', import.meta.url),
  'utf8',
)

function captureImageSource(): string {
  const start = storeSource.indexOf('captureImage')
  assert.notEqual(start, -1, 'orders store must expose captureImage')
  return storeSource.slice(start)
}

test('store refuses invalid WEIGHT quantities before any upload', () => {
  const capture = captureImageSource()
  const guard = capture.search(/imageType\s*===\s*['"]WEIGHT['"]|['"]WEIGHT['"]\s*===\s*imageType/)
  const invalidQuantity = capture.search(/quantity[\s\S]{0,120}(?:null|<=\s*0|nonnegative|positive)/i)
  const upload = capture.search(/upload/i)

  assert.notEqual(guard, -1, 'WEIGHT must have an explicit store guard')
  assert.notEqual(invalidQuantity, -1, 'the store guard must reject null or non-positive quantity')
  assert.notEqual(upload, -1, 'captureImage must upload valid captures')
  assert.ok(guard < upload, 'the WEIGHT quantity guard must precede upload')
  assert.ok(invalidQuantity < upload, 'the invalid quantity check must precede upload')
})

test('non-WEIGHT captures coerce quantity to null and identify the admin actor', () => {
  const capture = captureImageSource()
  assert.match(capture, /BELONGING/)
  assert.match(capture, /DOCUMENT/)
  assert.match(capture, /quantity\s*:/)
  assert.match(capture, /null/)
  assert.match(capture, /createdBy\s*:\s*['"]admin['"]/)
})

test('the orders store consumes the feature service and contract DTOs', () => {
  assert.match(storeSource, /services\/[^'"\n]*order-image|order-image[^'"\n]*services/)
  assert.match(storeSource, /@contracts\/order-images\/order-image-api\.schema/)
  assert.match(storeSource, /z\.infer/)
})

console.log('order-image-capture store dry tests passed')
