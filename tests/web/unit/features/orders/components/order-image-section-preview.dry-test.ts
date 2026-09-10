import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const imageSectionSource = readFileSync(
  new URL('../../../../../../src/features/orders/components/OrderImageSection.vue', import.meta.url),
  'utf8',
)
const detailPageSource = readFileSync(
  new URL('../../../../../../src/features/orders/pages/OrderDetailPage.vue', import.meta.url),
  'utf8',
)

test('order image thumbnails emit a preview request for displayable images', () => {
  assert.match(imageSectionSource, /preview: \[imagePath: string, alt: string\]/)
  assert.match(imageSectionSource, /<button[\s\S]*v-if="isDisplayableImagePath\(image\.imagePath\)"[\s\S]*@click="previewImage\(image\.imagePath, image\.imageType\)"/)
})

test('the order detail page opens the shared lightbox for the selected image', () => {
  assert.match(detailPageSource, /import LightboxOverlay from '@\/shared\/layouts\/LightboxOverlay\.vue'/)
  assert.match(detailPageSource, /<OrderImageSection[^>]*@preview="openImagePreview"/)
  assert.match(detailPageSource, /<LightboxOverlay[\s\S]*:open="selectedImagePreview !== null"[\s\S]*@close="selectedImagePreview = null"/)
  assert.match(detailPageSource, /:src="selectedImagePreview\.src"/)
})

test('changing orders closes an image preview from the previous order', () => {
  assert.match(detailPageSource, /watch\(orderId, \(id\) => \{\s*selectedImagePreview\.value = null/)
})
