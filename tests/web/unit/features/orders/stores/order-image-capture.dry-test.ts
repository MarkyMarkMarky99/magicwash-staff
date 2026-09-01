import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const storeSource = readFileSync(
  new URL('../../../../../../src/features/orders/stores/order-image.store.ts', import.meta.url),
  'utf8',
)

function captureImageSource(): string {
  const start = storeSource.indexOf('captureImage')
  assert.notEqual(start, -1, 'order image store must expose captureImage')
  return storeSource.slice(start)
}

test('store refuses invalid WEIGHT quantities before any upload', () => {
  const capture = captureImageSource()
  const guard = capture.search(/input\.imageType\s*===\s*['"]WEIGHT['"]/)
  const invalidQuantity = capture.search(/input\.quantity\s*===\s*null[\s\S]{0,80}!\(input\.quantity\s*>\s*0\)/)
  const upload = capture.search(/uploadOrderImage\(/)

  assert.notEqual(guard, -1, 'WEIGHT must have an explicit store guard')
  assert.notEqual(invalidQuantity, -1, 'the store guard must reject null or non-positive quantity')
  assert.notEqual(upload, -1, 'captureImage must upload valid captures')
  assert.ok(guard < upload, 'the WEIGHT quantity guard must precede upload')
  assert.ok(invalidQuantity < upload, 'the invalid quantity check must precede upload')
})

test('non-WEIGHT captures coerce quantity to null and identify the admin actor', () => {
  const capture = captureImageSource()
  assert.match(capture, /const quantity = input\.imageType === 'WEIGHT' \? input\.quantity : null/)
  assert.match(capture, /imageType: input\.imageType/)
  assert.match(capture, /quantity,/)
  assert.match(capture, /null/)
  assert.match(capture, /createdBy\s*:\s*ORDER_IMAGE_CREATED_BY/)
  assert.match(storeSource, /const ORDER_IMAGE_CREATED_BY = ['"]admin['"]$/m)
})

test('burst captures use a counter and append only to the active order', () => {
  assert.match(storeSource, /const uploadingCount = ref\(0\)/)
  assert.match(storeSource, /uploadingCount\.value \+= 1/)
  assert.match(storeSource, /uploadingCount\.value -= 1/)
  assert.match(storeSource, /if \(imagesOrderId\.value === input\.orderId\)/)
  assert.match(storeSource, /images\.value = \[\.\.\.images\.value, created\]/)
})

test('list loads discard stale responses and clearImages invalidates them', () => {
  assert.match(storeSource, /const requestSequence = \+\+imagesRequestSequence/)
  assert.match(storeSource, /if \(requestSequence !== imagesRequestSequence\) return/)
  assert.match(storeSource, /imagesRequestSequence \+= 1/)
  assert.match(storeSource, /images\.value = \[\]/)
  assert.match(storeSource, /imagesOrderId\.value = null/)
})

test('store composes feature services and exposes upload errors', () => {
  assert.match(storeSource, /import \{ createOrderImage, listOrderImages, type OrderImageDto \} from ['"]@\/features\/orders\/services\/order-image\.service['"]/)
  assert.match(storeSource, /import \{ uploadOrderImage \} from ['"]@\/features\/orders\/services\/order-image-storage\.service['"]/)
  assert.match(storeSource, /uploadError\.value = errorMessage\(reason, 'อัปโหลดรูปภาพไม่สำเร็จ'\)/)
  assert.match(storeSource, /return \{ images,[\s\S]*captureImage, clearImages, clearUploadError \}/)
})

console.log('order-image-capture store dry tests passed')
