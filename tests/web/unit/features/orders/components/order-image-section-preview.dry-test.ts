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

test('order image thumbnails emit the image id for displayable images', () => {
  assert.match(imageSectionSource, /preview: \[orderImageId: string\]/)
  assert.match(imageSectionSource, /<button[\s\S]*v-if="isDisplayableImagePath\(image\.imagePath\)"[\s\S]*@click="previewImage\(image\)"/)
  assert.match(imageSectionSource, /emit\('preview', image\.orderImageId\)/)
})

test('the order detail page opens the shared photo viewer from the photo query', () => {
  assert.match(detailPageSource, /import PhotoViewer, \{ type PhotoViewerImage \} from '@\/shared\/components\/PhotoViewer\.vue'/)
  assert.doesNotMatch(detailPageSource, /LightboxOverlay/)
  assert.match(detailPageSource, /<OrderImageSection[^>]*@preview="openImagePreview"/)
  assert.match(detailPageSource, /<PhotoViewer :images="viewerImages" :active-id="activePhotoId" @change="changePhoto" @close="closePhotoViewer" \/>/)
  assert.match(detailPageSource, /const PHOTO_QUERY_KEY = 'photo'/)
})

test('swiping replaces the photo query and closing leaves no viewer entry in history', () => {
  assert.match(detailPageSource, /function changePhoto[\s\S]*?router\.replace\(\{ query: \{ \.\.\.route\.query, \[PHOTO_QUERY_KEY\]: orderImageId \} \}\)/)
  assert.match(detailPageSource, /function closePhotoViewer[\s\S]*?router\.back\(\)[\s\S]*?router\.replace\(\{ query \}\)/)
})
