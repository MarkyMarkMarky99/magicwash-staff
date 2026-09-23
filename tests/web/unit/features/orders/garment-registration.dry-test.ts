import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { canSaveGarment, isDuplicateGarmentTag, validGarmentTag } from '@/features/orders/garment-registration'
import { buildOrderOverlayQuery, readOrderOverlay, readRegistrationItemId } from '@/features/orders/composables/use-order-overlay-route'

const itemRowSource = readFileSync(new URL('../../../../../src/features/orders/components/OrderItemRow.vue', import.meta.url), 'utf8')
const detailSource = readFileSync(new URL('../../../../../src/features/orders/pages/OrderDetailPage.vue', import.meta.url), 'utf8')
const cameraSource = readFileSync(new URL('../../../../../src/features/orders/components/GarmentRegistrationCamera.vue', import.meta.url), 'utf8')

test('tag validation uses the print contract format', () => {
  assert.equal(validGarmentTag(' 12345678 '), '12345678')
  assert.equal(validGarmentTag('0AaZ9bY1'), '0AaZ9bY1')
  for (const value of ['1234567', '123456789', '1234-678', 'abcdefgh!']) {
    assert.equal(validGarmentTag(value), null)
  }
})

test('existing and session tags both prevent another registration', () => {
  assert.equal(isDuplicateGarmentTag('12345678', new Set(['12345678']), new Set()), true)
  assert.equal(isDuplicateGarmentTag('12345678', new Set(), new Set(['12345678'])), true)
  assert.equal(isDuplicateGarmentTag('12345678', new Set(), new Set()), false)
})

test('save requires a tag, a photo, and no duplicate', () => {
  const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
  assert.equal(canSaveGarment('12345678', file, new Set(), new Set()), true)
  assert.equal(canSaveGarment(null, file, new Set(), new Set()), false)
  assert.equal(canSaveGarment('12345678', null, new Set(), new Set()), false)
  assert.equal(canSaveGarment('invalid', file, new Set(), new Set()), false)
  assert.equal(canSaveGarment('12345678', file, new Set(['12345678']), new Set()), false)
  assert.equal(canSaveGarment('12345678', file, new Set(), new Set(['12345678'])), false)
})

test('registration route state carries the order item and closes cleanly', () => {
  const query = { orderAction: 'register-garment', registerItem: 'order-item-1', page: '2' }
  assert.equal(readOrderOverlay(query), 'register-garment')
  assert.equal(readRegistrationItemId(query), 'order-item-1')
  assert.equal(readRegistrationItemId({ ...query, registerItem: '' }), null)
  assert.deepEqual(buildOrderOverlayQuery(query, null), { page: '2' })
  assert.match(itemRowSource, /emit\('register', item\.orderItemId\)/)
  assert.match(detailSource, /@register="openRegistration"/)
  assert.match(detailSource, /orderOverlay\.open\('register-garment', orderItemId\)/)
})

test('registration scans and captures in either mode and saves when complete', () => {
  assert.match(cameraSource, /if \(result && !props\.tag\)/)
  assert.match(cameraSource, /if \(!video \|\| !stream \|\| capturing\.value/)
  assert.match(cameraSource, /:disabled="pendingCount > 0"/)
  assert.match(cameraSource, /@keydown\.enter\.prevent="submitTag"/)
  assert.doesNotMatch(cameraSource, /emit\('save'\)|manualOpen|redoPhoto/)
  assert.match(detailSource, /watch\(registrationCanSave, ready => \{\s*if \(ready\) saveRegistration\(\)/)
})

test('order preload keeps early tags pending without covering the camera', () => {
  assert.match(detailSource, /watch\(orderId, \(id\) => \{[\s\S]*void loadRegistrationTags\(id\)/)
  assert.doesNotMatch(detailSource, /watch\(\[isRegistrationOpen, orderId\]/)
  assert.match(detailSource, /mergeRegistrationTags\(tags\)[\s\S]*registrationTagsReady\.value = true/)
  assert.match(detailSource, /:tag-checking="registrationTag !== null && registrationLoading"/)
  assert.match(cameraSource, /v-if="tagChecking"/)
  assert.doesNotMatch(cameraSource, /กำลังตรวจสอบแท็กเดิม|props\.loading/)
})

test('capture feedback keeps the latest thumbnail without navigation', () => {
  assert.match(cameraSource, /showShutterFlash\(\)/)
  assert.match(cameraSource, /showCaptureFeedback\(canvas, sessionId\)/)
  assert.match(cameraSource, /setLastPreview\(file\)/)
  assert.match(cameraSource, /URL\.revokeObjectURL\(lastPreviewUrl\.value\)/)
  assert.match(cameraSource, /class="capture-flyout/)
  assert.match(cameraSource, /:src="lastPreviewUrl"/)
  assert.doesNotMatch(cameraSource, /@click="closeCamera\(\)"/)
})

test('photo is the default and reset mode while either missing half selects its mode', () => {
  assert.match(cameraSource, /const mode = ref<'scan' \| 'photo'>\('photo'\)/)
  assert.match(cameraSource, /watch\(\(\) => props\.resetVersion,[\s\S]*mode\.value = 'photo'/)
  assert.match(cameraSource, /if \(!props\.tag\) mode\.value = 'scan'/)
  assert.match(cameraSource, /if \(!props\.hasPhoto\) mode\.value = 'photo'/)
  const scanFrame = cameraSource.match(/<div v-if="mode === 'scan'[^>]*>[\s\S]*?<\/div>/)?.[0]
  assert.ok(scanFrame)
  assert.match(scanFrame, /w-\[min\(60vmin,16rem\)\]/)
  assert.equal(scanFrame.match(/border-lime/g)?.length, 5)
  assert.doesNotMatch(scanFrame, /bg-lime|border-2|border-4/)
  assert.match(scanFrame, /class="scan-line absolute inset-x-0 top-1\/2 border-t border-lime"/)
  assert.match(cameraSource, /\.scan-line\s*\{\s*animation: scan-line 2s ease-in-out infinite;/)
  assert.match(cameraSource, /@keyframes scan-line\s*\{[\s\S]*?transform: translateY\(/)
  assert.match(cameraSource, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.scan-line\s*\{\s*animation: none;\s*transform: translateY\(0\);/)
})

test('fresh tag IDs merge and recheck a waiting tag', () => {
  assert.match(detailSource, /listLaundryPhotoTagIds\(id, freshTags =>/)
  assert.match(detailSource, /mergeRegistrationTags\(freshTags\)/)
  assert.match(detailSource, /const pendingTag = registrationTag\.value[\s\S]*isDuplicateGarmentTag\(pendingTag, merged, sessionRegistrationTags\.value\)/)
})
